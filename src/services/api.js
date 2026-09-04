/**
 * Fachada compatível do runtime de IA.
 *
 * O pipeline e ferramentas administrativas mantêm as assinaturas públicas
 * existentes, enquanto gateway/providers/scheduler ficam isolados em src/ai.
 * Esta camada não conhece DOM nem PipelineUI.
 */

let runtime = null;

/**
 * Recebe a instância criada no composition root da aplicação.
 * @param {{
 *  generateForAgent(agentNum: number, request: import('../ai/contracts.js').ProviderRequest, options: {signal: AbortSignal, emit: (event: import('../ai/contracts.js').ProviderEvent) => void}): Promise<import('../ai/contracts.js').ProviderResult>,
 *  generateWithProvider(provider: import('../ai/contracts.js').ProviderName, request: import('../ai/contracts.js').ProviderRequest, options: {signal: AbortSignal, emit: (event: import('../ai/contracts.js').ProviderEvent) => void}): Promise<import('../ai/contracts.js').ProviderResult>
 * }} configuredRuntime
 */
export function configureAiRuntime(configuredRuntime) {
  runtime = configuredRuntime;
}

function requireRuntime() {
  if (!runtime) throw new Error('Runtime de IA ainda não foi inicializado.');
  return runtime;
}

function activeSignal(signal) {
  return signal || new AbortController().signal;
}

function createEventSink(options = {}) {
  return event => {
    try { options.onEvent?.(event); }
    catch { /* Feedback visual não altera a chamada. */ }

    if (event.type !== 'usage') return;
    try { options.onUsage?.(event.usage); }
    catch (error) {
      console.warn('[FastSEO] Não foi possível atualizar o contador de tokens.', error);
    }
  };
}

function requestOf(system, userMessage, maxTokens, jsonMode = false) {
  return {
    system: String(system || ''),
    userMessage: String(userMessage || ''),
    maxTokens: Math.max(1, Math.round(Number(maxTokens) || 1)),
    jsonMode: Boolean(jsonMode),
  };
}

/** Compatibilidade com a análise de categoria, que exige Gemini explicitamente. */
export async function callGemini(system, userMsg, maxTokens, _attempt = 1, signal = null, options = {}) {
  const result = await requireRuntime().generateWithProvider(
    'gemini',
    requestOf(system, userMsg, maxTokens, options.jsonMode),
    { signal: activeSignal(signal), emit: createEventSink(options) },
  );
  return result.text;
}

/** Compatibilidade para consumidores que solicitam Mistral diretamente. */
export async function callMistral(system, userMsg, maxTokens, signal = null, _attempt = 0, options = {}) {
  const result = await requireRuntime().generateWithProvider(
    'mistral',
    requestOf(system, userMsg, maxTokens, options.jsonMode),
    { signal: activeSignal(signal), emit: createEventSink(options) },
  );
  return result.text;
}

/**
 * Contrato estável usado pelo pipeline. O gateway resolve o provedor e modelo
 * escolhidos pelo usuário para A1, A2 e A3 e controla os fallbacks.
 */
export async function callAgent(system, userMsg, maxTokens, signal, agentNum, tracking = {}) {
  const result = await requireRuntime().generateForAgent(
    agentNum,
    requestOf(system, userMsg, maxTokens, agentNum === 2),
    { signal: activeSignal(signal), emit: createEventSink(tracking) },
  );
  return result.text;
}
