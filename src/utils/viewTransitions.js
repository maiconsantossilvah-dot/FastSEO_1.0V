const activeTransitions = new WeakMap();
const latestUpdates = new WeakMap();

function isExpectedTransitionAbort(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  return name === 'AbortError'
    || name === 'InvalidStateError'
    || /transition.*abort|invalid state/i.test(message);
}

function reportUnexpected(error, onError) {
  if (isExpectedTransitionAbort(error)) return;
  try { onError(error); }
  catch { /* Um observador de erro não pode interromper a navegação. */ }
}

function observeTransitionPromise(promise, onError) {
  if (!promise || typeof promise.catch !== 'function') return;
  void promise.catch(error => reportUnexpected(error, onError));
}

/**
 * Aplica uma atualização de interface usando a View Transition API quando ela
 * estiver disponível. Cliques concorrentes encerram a animação anterior e
 * aplicam apenas a atualização mais recente, evitando estados visuais antigos.
 *
 * @param {() => void | Promise<void>} update
 * @param {{documentRef?: Document, animate?: boolean, onError?: (error: unknown) => void}} [options]
 * @returns {ViewTransition | null}
 */
export function runViewTransition(update, options = {}) {
  const documentRef = options.documentRef || globalThis.document;
  const animate = options.animate !== false;
  const onError = options.onError || (error => console.error('[FastSEO] Falha na transição visual:', error));
  const updateId = {};
  let updateApplied = false;

  latestUpdates.set(documentRef, updateId);

  const applyLatestUpdate = () => {
    if (updateApplied || latestUpdates.get(documentRef) !== updateId) return undefined;
    updateApplied = true;
    return update();
  };

  if (!animate
    || documentRef.visibilityState === 'hidden'
    || typeof documentRef.startViewTransition !== 'function') {
    applyLatestUpdate();
    return null;
  }

  const active = activeTransitions.get(documentRef);
  if (active) {
    try { active.skipTransition?.(); }
    catch (error) { reportUnexpected(error, onError); }
    applyLatestUpdate();
    return null;
  }

  try {
    const transition = documentRef.startViewTransition(applyLatestUpdate);
    activeTransitions.set(documentRef, transition);

    // ready rejeita quando o navegador pula uma transição; sem estes handlers
    // o Chrome registra um "Uncaught (in promise) InvalidStateError".
    observeTransitionPromise(transition.ready, onError);
    observeTransitionPromise(transition.updateCallbackDone, onError);
    observeTransitionPromise(transition.finished, onError);

    void Promise.resolve(transition.finished)
      .catch(() => undefined)
      .finally(() => {
        if (activeTransitions.get(documentRef) === transition) {
          activeTransitions.delete(documentRef);
        }
      });

    return transition;
  } catch (error) {
    // Alguns navegadores lançam InvalidStateError de forma síncrona. A troca
    // de conteúdo continua funcionando mesmo quando a animação não pode rodar.
    applyLatestUpdate();
    reportUnexpected(error, onError);
    return null;
  }
}
