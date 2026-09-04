import { describe, expect, it, vi } from 'vitest';
import { runViewTransition } from '../../src/utils/viewTransitions.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createDocument() {
  const ready = deferred();
  const updateCallbackDone = deferred();
  const finished = deferred();
  let callback;
  const transition = {
    ready: ready.promise,
    updateCallbackDone: updateCallbackDone.promise,
    finished: finished.promise,
    skipTransition: vi.fn(),
  };
  const documentRef = {
    visibilityState: 'visible',
    startViewTransition: vi.fn(next => {
      callback = next;
      return transition;
    }),
  };
  return {
    documentRef, transition, ready, updateCallbackDone, finished,
    runCallback: () => callback(),
  };
}

describe('runViewTransition', () => {
  it('aplica a atualização diretamente quando a API não está disponível', () => {
    const update = vi.fn();
    const documentRef = { visibilityState: 'visible' };

    expect(runViewTransition(update, { documentRef })).toBeNull();
    expect(update).toHaveBeenCalledOnce();
  });

  it('ignora o aborto esperado da animação sem registrar erro', async () => {
    const fixture = createDocument();
    const onError = vi.fn();
    const update = vi.fn();

    runViewTransition(update, { documentRef: fixture.documentRef, onError });
    fixture.runCallback();
    fixture.ready.reject(new DOMException('Transition was aborted because of invalid state', 'InvalidStateError'));
    fixture.updateCallbackDone.resolve();
    fixture.finished.resolve();
    await Promise.resolve();

    expect(update).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('em cliques concorrentes aplica somente a visualização mais recente', async () => {
    const fixture = createDocument();
    const firstUpdate = vi.fn();
    const latestUpdate = vi.fn();

    runViewTransition(firstUpdate, { documentRef: fixture.documentRef });
    runViewTransition(latestUpdate, { documentRef: fixture.documentRef });

    expect(fixture.transition.skipTransition).toHaveBeenCalledOnce();
    expect(latestUpdate).toHaveBeenCalledOnce();
    fixture.runCallback();
    expect(firstUpdate).not.toHaveBeenCalled();

    fixture.ready.resolve();
    fixture.updateCallbackDone.resolve();
    fixture.finished.resolve();
    await Promise.resolve();
  });

  it('mantém a navegação funcional quando startViewTransition lança erro', () => {
    const update = vi.fn();
    const onError = vi.fn();
    const documentRef = {
      visibilityState: 'visible',
      startViewTransition: vi.fn(() => {
        throw new DOMException('Transition was aborted because of invalid state', 'InvalidStateError');
      }),
    };

    expect(runViewTransition(update, { documentRef, onError })).toBeNull();
    expect(update).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });
});
