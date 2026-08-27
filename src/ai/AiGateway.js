/**
 * Fachada de roteamento do runtime. A separação entre gateway, providers e
 * scheduler é uma decisão deliberada de testabilidade; veja
 * docs/adr/0001-ai-runtime-boundaries.md.
 */
import { ProviderRuntimeError, normalizeProviderError } from './errors.js';

function safeEmit(emit, event) {
  try { emit(event); }
  catch { /* A interface não pode quebrar o domínio. */ }
}

export class AiGateway {
  /** @param {{providers: {gemini: import('./contracts.js').AiProvider & {isAvailable(): boolean}, mistral: import('./contracts.js').AiProvider & {isAvailable(): boolean}}}} dependencies */
  constructor(dependencies) {
    this.providers = dependencies.providers;
  }

  /**
   * @param {number} agentNum
   * @param {import('./contracts.js').ProviderRequest} request
   * @param {{signal: AbortSignal, emit: (event: import('./contracts.js').ProviderEvent) => void}} options
   */
  async generateForAgent(agentNum, request, options) {
    const initial = agentNum === 1 ? 'mistral' : 'gemini';
    const alternate = initial === 'gemini' ? 'mistral' : 'gemini';

    if (!this.providers[initial].isAvailable()) {
      if (!this.providers[alternate].isAvailable()) throw this._noProviders(agentNum, initial);
      safeEmit(options.emit, { type: 'provider-fallback', from: initial, to: alternate, reason: 'invalid-key' });
      return this._run(alternate, request, options);
    }

    try {
      return await this._run(initial, request, options);
    } catch (error) {
      const normalized = normalizeProviderError(error, initial);
      if (normalized.code === 'aborted' || !normalized.fallbackEligible) throw normalized;
      if (!this.providers[alternate].isAvailable()) throw normalized;
      safeEmit(options.emit, {
        type: 'provider-fallback', from: initial, to: alternate, reason: normalized.code,
      });
      try {
        return await this._run(alternate, request, options);
      } catch (fallbackError) {
        const fallback = normalizeProviderError(fallbackError, alternate);
        if (fallback.code === 'aborted' || !fallback.fallbackEligible) throw fallback;
        throw this._noProviders(agentNum, alternate, fallback);
      }
    }
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

  _run(provider, request, options) {
    return this.providers[provider].generate(request, {
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
