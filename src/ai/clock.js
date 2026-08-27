function clockAbortError(reason) {
  const error = new Error('Operação cancelada.', { cause: reason });
  error.name = 'AbortError';
  return error;
}

/** @type {import('./contracts.js').RuntimeClock} */
export const systemClock = Object.freeze({
  now: () => Date.now(),

  sleep(ms, signal) {
    const duration = Math.max(0, Number(ms) || 0);
    if (signal.aborted) return Promise.reject(clockAbortError(signal.reason));

    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = 0;

      const cleanup = () => signal.removeEventListener('abort', onAbort);
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timer);
        cleanup();
        reject(clockAbortError(signal.reason));
      };

      signal.addEventListener('abort', onAbort, { once: true });
      timer = globalThis.setTimeout(finish, duration);
    });
  },
});
