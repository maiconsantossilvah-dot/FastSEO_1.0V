import { ProviderRuntimeError, normalizeProviderError, throwIfAborted } from '../errors.js';

/** @param {import('../contracts.js').ProviderContext} context @param {import('../contracts.js').ProviderEvent} event */
export function safeEmit(context, event) {
  try { context.emit(event); }
  catch { /* Métricas e UI não podem alterar o resultado da chamada. */ }
}

/** @param {Response} response */
export async function safeJson(response) {
  try { return await response.json(); }
  catch { return {}; }
}

/** @param {string} message */
export function isDailyQuota(message) {
  return /daily|per day|quota.*day|requests per day|cota di[aá]ria/i.test(message || '');
}

/** @param {string} message */
export function isOverloaded(message) {
  return /overloaded|service.?unavailable|capacity|too many|temporarily unavailable/i.test(message || '');
}

/**
 * Identifica bloqueios globais de plano/tier. Diferente de um pico normal de
 * rate limit, repetir a mesma chamada não ajuda; o gateway deve trocar de
 * provedor imediatamente.
 */
export function isTierTemporarilyUnavailable(message) {
  const value = String(message || '');
  return /\bfree[\s_-]*tier\b.*\b(disabled|unavailable|suspended)\b/i.test(value)
    || /\b(disabled|unavailable|suspended)\b.*\bfree[\s_-]*tier\b/i.test(value)
    || /\b(plan|tier)\b.*\btemporarily\b.*\b(disabled|unavailable|suspended)\b/i.test(value);
}

/**
 * @param {Response} response
 * @param {import('../contracts.js').RuntimeClock} clock
 */
export function retryAfterMs(response, clock) {
  const raw = response.headers?.get?.('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(1000, seconds * 1000);
  const absolute = Date.parse(raw);
  return Number.isFinite(absolute) ? Math.max(1000, absolute - clock.now()) : null;
}

/**
 * Executa somente tentativas HTTP prontas. O backoff ocorre fora do scheduler,
 * evitando que um retry distante bloqueie chamadas normais na fila FIFO.
 * @param {{
 *  provider: import('../contracts.js').ProviderName,
 *  scheduler: import('../contracts.js').ProviderScheduler,
 *  clock: import('../contracts.js').RuntimeClock,
 *  context: import('../contracts.js').ProviderContext,
 *  fetcher: () => Promise<Response>,
 *  maxRetries: number,
 *  errorMessage: (raw: unknown) => string
 * }} options
 */
export async function requestWithRetry(options) {
  const { provider, scheduler, clock, context, fetcher, maxRetries, errorMessage } = options;
  let retryAttempt = 0;

  while (true) {
    throwIfAborted(context.signal, provider);
    let response;
    try {
      response = await scheduler.schedule(fetcher, context);
    } catch (error) {
      throw normalizeProviderError(error, provider);
    }

    const rateLimited = response.status === 429;
    const overloadedStatus = response.status === 503 || response.status === 529;
    if (!rateLimited && !overloadedStatus) return response;

    const raw = await safeJson(response);
    const message = errorMessage(raw) || `HTTP ${response.status}`;
    if (isTierTemporarilyUnavailable(message)) {
      throw new ProviderRuntimeError(`${provider} temporariamente indisponível para o plano atual.`, {
        code: 'overloaded', provider, retryable: false, fallbackEligible: true, providerWide: true,
      });
    }
    if (rateLimited && isDailyQuota(message)) {
      throw new ProviderRuntimeError('Cota diária esgotada.', {
        code: 'daily-quota', provider, retryable: false, fallbackEligible: true,
      });
    }

    const code = rateLimited ? 'rate-limit' : 'overloaded';
    if (rateLimited) safeEmit(context, { type: 'rate-limit', provider });

    if (retryAttempt >= maxRetries) {
      throw new ProviderRuntimeError(
        rateLimited ? `Limite por minuto persistente (${provider}).` : `${provider} temporariamente indisponível.`,
        { code, provider, retryable: false, fallbackEligible: true },
      );
    }

    retryAttempt += 1;
    const explicitRetry = retryAfterMs(response, clock);
    const waitMs = explicitRetry ?? Math.min(90000, retryAttempt * 15000);
    safeEmit(context, { type: 'retry', provider, attempt: retryAttempt, waitMs });
    try {
      await clock.sleep(waitMs, context.signal);
    } catch (error) {
      throw normalizeProviderError(error, provider);
    }
  }
}

/** @param {import('../contracts.js').ProviderErrorCode} code */
export function shouldRotateKey(code) {
  return ['rate-limit', 'daily-quota', 'overloaded'].includes(code);
}
