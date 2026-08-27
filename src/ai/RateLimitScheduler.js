import { createAbortError, throwIfAborted } from './errors.js';

function safeEmit(context, event) {
  try { context.emit(event); }
  catch { /* Observabilidade nunca pode interromper uma requisição. */ }
}

/**
 * Fila FIFO de uma única instância de provedor. Ela conhece somente pacing e
 * cancelamento; retry e fallback permanecem fora desta camada.
 */
export class RateLimitScheduler {
  /** @param {{minDelayMs: number, clock: import('./contracts.js').RuntimeClock}} options */
  constructor(options) {
    this.minDelayMs = Math.max(0, Number(options.minDelayMs) || 0);
    this.clock = options.clock;
    this.nextAvailableAt = 0;
    this.queue = [];
    this.running = false;
  }

  /**
   * @template T
   * @param {() => Promise<T>} task
   * @param {import('./contracts.js').ProviderContext} context
   * @returns {Promise<T>}
   */
  schedule(task, context) {
    if (context.signal.aborted) return Promise.reject(createAbortError(context.provider, context.signal.reason));

    return new Promise((resolve, reject) => {
      const entry = {
        task, context, resolve, reject,
        started: false,
        settled: false,
        cancelled: false,
        onAbort: null,
      };

      entry.onAbort = () => {
        if (entry.started || entry.settled) return;
        entry.cancelled = true;
        this.queue = this.queue.filter(candidate => candidate !== entry);
        this._reject(entry, createAbortError(context.provider, context.signal.reason));
        this._drain();
      };

      context.signal.addEventListener('abort', entry.onAbort, { once: true });
      this.queue.push(entry);
      this._drain();
    });
  }

  _drain() {
    if (this.running) return;
    const entry = this.queue.shift();
    if (!entry) return;
    if (entry.cancelled || entry.settled) { this._drain(); return; }
    this.running = true;
    void this._run(entry);
  }

  async _run(entry) {
    const { context } = entry;
    try {
      throwIfAborted(context.signal, context.provider);
      // Retries chegam aqui somente depois do backoff. Ignorar notBefore evita
      // que uma entrada futura bloqueie tarefas prontas atrás dela (HOL blocking).
      const waitMs = Math.max(0, this.nextAvailableAt - this.clock.now());
      if (waitMs > 0) {
        safeEmit(context, { type: 'queued', provider: context.provider, waitMs });
        await this.clock.sleep(waitMs, context.signal);
      }

      throwIfAborted(context.signal, context.provider);
      entry.started = true;
      const actualStartedAt = this.clock.now();
      this.nextAvailableAt = actualStartedAt + this.minDelayMs;
      const result = await entry.task();
      this._resolve(entry, result);
    } catch (error) {
      this._reject(entry, error);
    } finally {
      this.running = false;
      this._drain();
    }
  }

  _cleanup(entry) {
    if (entry.onAbort) entry.context.signal.removeEventListener('abort', entry.onAbort);
  }

  _resolve(entry, value) {
    if (entry.settled) return;
    entry.settled = true;
    this._cleanup(entry);
    entry.resolve(value);
  }

  _reject(entry, error) {
    if (entry.settled) return;
    entry.settled = true;
    this._cleanup(entry);
    entry.reject(error);
  }
}
