import { describe, expect, it, vi } from 'vitest';
import { RateLimitScheduler } from '../../src/ai/RateLimitScheduler.js';

class ManualClock {
  constructor(now = 0, lateBy = 0) {
    this.value = now;
    this.lateBy = lateBy;
    this.sleeps = [];
  }

  now() { return this.value; }

  async sleep(ms, signal) {
    if (signal.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }
    this.sleeps.push(ms);
    this.value += ms + this.lateBy;
    this.lateBy = 0;
  }
}

const context = (provider = 'gemini', controller = new AbortController(), events = []) => ({
  provider,
  signal: controller.signal,
  emit: event => events.push(event),
});

describe('RateLimitScheduler', () => {
  it('executa FIFO e mede o intervalo entre inícios reais', async () => {
    const clock = new ManualClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const starts = [];
    const events = [];

    const first = scheduler.schedule(async () => { starts.push(clock.now()); return 'a'; }, context('gemini', undefined, events));
    const second = scheduler.schedule(async () => { starts.push(clock.now()); return 'b'; }, context('gemini', undefined, events));

    await expect(first).resolves.toBe('a');
    await expect(second).resolves.toBe('b');
    expect(starts).toEqual([0, 4500]);
    expect(events).toContainEqual({ type: 'queued', provider: 'gemini', waitMs: 4500 });
  });

  it('usa o início real quando o relógio acorda depois do horário planejado', async () => {
    const clock = new ManualClock(0, 1000);
    const scheduler = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const starts = [];

    await scheduler.schedule(async () => { starts.push(clock.now()); }, context());
    await scheduler.schedule(async () => { starts.push(clock.now()); }, context());
    await scheduler.schedule(async () => { starts.push(clock.now()); }, context());

    expect(starts).toEqual([0, 5500, 10000]);
  });

  it('remove uma entrada cancelada antes de começar sem consumir janela', async () => {
    const clock = new ManualClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 100, clock });
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    const first = scheduler.schedule(() => barrier, context());
    const cancelledController = new AbortController();
    const cancelledTask = vi.fn(async () => 'cancelled');
    const cancelled = scheduler.schedule(cancelledTask, context('gemini', cancelledController));
    const nextTask = vi.fn(async () => 'next');
    const next = scheduler.schedule(nextTask, context());

    cancelledController.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    release('first');
    await expect(first).resolves.toBe('first');
    await expect(next).resolves.toBe('next');
    expect(cancelledTask).not.toHaveBeenCalled();
    expect(nextTask).toHaveBeenCalledOnce();
    expect(clock.sleeps).toEqual([100]);
  });

  it('não deixa erro ou cancelamento em voo corromper N+1', async () => {
    const clock = new ManualClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 50, clock });
    const controller = new AbortController();
    const inFlight = scheduler.schedule(() => new Promise((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }), context('gemini', controller));
    const next = scheduler.schedule(async () => 'ok', context());

    controller.abort();
    await expect(inFlight).rejects.toMatchObject({ name: 'AbortError' });
    await expect(next).resolves.toBe('ok');

    const failed = scheduler.schedule(async () => { throw new Error('falhou'); }, context());
    const afterFailure = scheduler.schedule(async () => 'continua', context());
    await expect(failed).rejects.toThrow('falhou');
    await expect(afterFailure).resolves.toBe('continua');
  });

  it('mantém schedulers de provedores independentes', async () => {
    const clock = new ManualClock();
    const gemini = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const mistral = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const starts = [];

    await Promise.all([
      gemini.schedule(async () => starts.push(['gemini', clock.now()]), context('gemini')),
      mistral.schedule(async () => starts.push(['mistral', clock.now()]), context('mistral')),
    ]);

    expect(starts).toEqual(expect.arrayContaining([['gemini', 0], ['mistral', 0]]));
  });
});
