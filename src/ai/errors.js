/**
 * Erro normalizado na fronteira do runtime de IA.
 * @extends {Error}
 */
export class ProviderRuntimeError extends Error {
  /**
   * @param {string} message
   * @param {{code: import('./contracts.js').ProviderErrorCode, provider: import('./contracts.js').ProviderName, retryable?: boolean, fallbackEligible?: boolean, providerWide?: boolean, cause?: unknown}} options
   */
  constructor(message, options) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = options.code === 'aborted' ? 'AbortError' : 'ProviderError';
    this.code = options.code;
    this.provider = options.provider;
    this.retryable = Boolean(options.retryable);
    this.fallbackEligible = Boolean(options.fallbackEligible);
    this.providerWide = Boolean(options.providerWide);

    // Compatibilidade temporária com consumidores anteriores à extração do runtime.
    this.cotaEsgotada = ['rate-limit', 'daily-quota', 'overloaded'].includes(options.code);
    this.dailyQuota = options.code === 'daily-quota';
    this.rateLimit = options.code === 'rate-limit';
    this.invalidKey = options.code === 'invalid-key';
  }
}

/** @param {unknown} error */
export function isAbortError(error) {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

/**
 * @param {import('./contracts.js').ProviderName} provider
 * @param {unknown} [cause]
 */
export function createAbortError(provider, cause) {
  return new ProviderRuntimeError('Operação cancelada.', {
    code: 'aborted', provider, retryable: false, fallbackEligible: false, cause,
  });
}

/**
 * @param {unknown} error
 * @param {import('./contracts.js').ProviderName} provider
 */
export function normalizeProviderError(error, provider) {
  if (error instanceof ProviderRuntimeError) return error;
  if (isAbortError(error)) return createAbortError(provider, error);
  const message = error instanceof Error ? error.message : 'Falha desconhecida no provedor de IA.';
  return new ProviderRuntimeError(message, {
    code: 'unknown', provider, retryable: false, fallbackEligible: false, cause: error,
  });
}

/**
 * Interrompe antes de qualquer espera ou chamada de rede.
 * @param {AbortSignal} signal
 * @param {import('./contracts.js').ProviderName} provider
 */
export function throwIfAborted(signal, provider) {
  if (signal.aborted) throw createAbortError(provider, signal.reason);
}
