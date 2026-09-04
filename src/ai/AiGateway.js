/**
 * Fachada de roteamento do runtime. A separação entre gateway, providers e
 * scheduler é uma decisão deliberada de testabilidade; veja
 * docs/adr/0001-ai-runtime-boundaries.md.
 */
import { ProviderRuntimeError, normalizeProviderError } from './errors.js';

const DEFAULT_ROUTES = Object.freeze({ 1: 'mistral', 2: 'gemini', 3: 'gemini' });

function providerOrder(preferred, availableNames) {
  const fallbackPriority = preferred === 'mistral'
    ? ['gemini', 'groq']
    : ['gemini', 'groq', 'mistral'];
  return [preferred, ...fallbackPriority]
    .filter((name, index, values) => availableNames.includes(name) && values.indexOf(name) === index);
}

function safeEmit(emit, event) {
  try { emit(event); }
  catch { /* A interface não pode quebrar o domínio. */ }
}

export class AiGateway {
  /** @param {{providers: Record<string, import('./contracts.js').AiProvider & {isAvailable(): boolean}>, getAgentRoute?: (agentNum: number) => {provider: import('./contracts.js').ProviderName, models?: Record<string, string>}}} dependencies */
  constructor(dependencies) {
    this.providers = dependencies.providers;
    this.getAgentRoute = dependencies.getAgentRoute || (agentNum => ({ provider: DEFAULT_ROUTES[agentNum] || 'gemini', models: {} }));
  }

  /**
   * @param {number} agentNum
   * @param {import('./contracts.js').ProviderRequest} request
   * @param {{signal: AbortSignal, emit: (event: import('./contracts.js').ProviderEvent) => void}} options
   */
  async generateForAgent(agentNum, request, options) {
    const route = this.getAgentRoute(agentNum) || {};
    const initial = this.providers[route.provider] ? route.provider : DEFAULT_ROUTES[agentNum] || 'gemini';
    const candidates = providerOrder(initial, Object.keys(this.providers));
    let lastError = null;
    let startIndex = 0;

    if (!this.providers[initial].isAvailable()) {
      startIndex = candidates.findIndex(name => this.providers[name].isAvailable());
      if (startIndex < 0) throw this._noProviders(agentNum, initial);
      safeEmit(options.emit, {
        type: 'provider-fallback', from: initial, to: candidates[startIndex], reason: 'invalid-key',
      });
    }

    for (let index = startIndex; index < candidates.length; index += 1) {
      const provider = candidates[index];
      const next = candidates.slice(index + 1).find(name => this.providers[name].isAvailable());

      if (!this.providers[provider].isAvailable()) continue;

      try {
        return await this._run(provider, request, options, route.models?.[provider]);
      } catch (error) {
        const normalized = normalizeProviderError(error, provider);
        if (normalized.code === 'aborted' || !normalized.fallbackEligible) throw normalized;
        lastError = normalized;
        if (!next) break;
        safeEmit(options.emit, {
          type: 'provider-fallback', from: provider, to: next, reason: normalized.code,
        });
      }
    }

    if (lastError && candidates.length === 1) throw lastError;
    throw this._noProviders(agentNum, initial, lastError || undefined);
  }

  /**
   * Chamada explícita usada por ferramentas administrativas que precisam de
   * um provedor específico e não devem trocar silenciosamente de fornecedor.
   * @param {import('./contracts.js').ProviderName} provider
   * @param {import('./contracts.js').ProviderRequest} request
   * @param {{signal: AbortSignal, emit: (event: import('./contracts.js').ProviderEvent) => void}} options
   */
  generateWithProvider(provider, request, options) {
    return this._run(provider, request, options);
  }

  _run(provider, request, options, model) {
    if (!this.providers[provider]) {
      throw new ProviderRuntimeError(`Provedor ${provider} não configurado.`, {
        code: 'invalid-response', provider, retryable: false, fallbackEligible: false,
      });
    }
    return this.providers[provider].generate({ ...request, ...(model ? { model } : {}) }, {
      provider, signal: options.signal, emit: options.emit,
    });
  }

  _noProviders(agentNum, provider, cause) {
    return new ProviderRuntimeError(
      `Todas as APIs falharam no A${agentNum}. Verifique chaves, cotas e tente novamente em alguns minutos.`,
      { code: 'unknown', provider, retryable: false, fallbackEligible: false, cause },
    );
  }
}
