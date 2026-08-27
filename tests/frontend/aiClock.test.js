import { afterEach, describe, expect, it, vi } from 'vitest';
import { systemClock } from '../../src/ai/clock.js';

describe('RuntimeClock', () => {
  afterEach(() => vi.useRealTimers());

  it('roda com relógio falso sem espera real', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let finished = false;
    const pending = systemClock.sleep(5000, controller.signal).then(() => { finished = true; });

    await vi.advanceTimersByTimeAsync(4999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(finished).toBe(true);
  });

  it('rejeita imediatamente e remove listener ao cancelar', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = systemClock.sleep(5000, controller.signal);

    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejeita sem criar timer quando já está cancelado', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();

    await expect(systemClock.sleep(1000, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
