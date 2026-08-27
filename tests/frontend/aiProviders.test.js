import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../../src/ai/providers/GeminiProvider.js';
import { MistralProvider } from '../../src/ai/providers/MistralProvider.js';
import { RateLimitScheduler } from '../../src/ai/RateLimitScheduler.js';

class FakeClock {
  constructor() { this.value = 0; this.sleeps = []; }
  now() { return this.value; }
  async sleep(ms, signal) {
    if (signal.aborted) {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      throw error;
    }
    this.sleeps.push(ms);
    this.value += ms;
  }
}

const request = { system: 'sistema', userMessage: 'produto', maxTokens: 100, jsonMode: false };
const successGemini = () => new Response(JSON.stringify({
  modelVersion: 'gemini-test',
  candidates: [{ content: { parts: [{ text: 'ficha' }] } }],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 },
}), { status: 200, headers: { 'content-type': 'application/json' } });
const successMistral = () => new Response(JSON.stringify({
  model: 'mistral-test', choices: [{ message: { content: 'ficha' } }],
  usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
}), { status: 200, headers: { 'content-type': 'application/json' } });
const context = events => ({ provider: 'gemini', signal: new AbortController().signal, emit: event => events.push(event) });

describe('providers de IA', () => {
  it('rotaciona chave Gemini por cota diária sem expor credenciais', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'daily quota exceeded' } }), { status: 429 }))
      .mockResolvedValueOnce(successGemini());
    const events = [];
    const provider = new GeminiProvider({
      scheduler, clock, fetch,
      getKeys: () => ['secret-key-one', 'secret-key-two'],
      getModel: () => 'gemini-test', validateKey: () => true, maxRetries: 0,
    });

    await expect(provider.generate(request, context(events))).resolves.toMatchObject({ text: 'ficha' });
    expect(events).toContainEqual({
      type: 'key-rotation', provider: 'gemini', fromKeyIndex: 1, toKeyIndex: 2, reason: 'daily-quota',
    });
    expect(JSON.stringify(events)).not.toContain('secret-key');
  });

  it('não rotaciona chave inválida', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'invalid' } }), { status: 401 }));
    const events = [];
    const provider = new GeminiProvider({
      scheduler, clock, fetch,
      getKeys: () => ['invalid-one', 'unused-two'],
      getModel: () => 'gemini-test', validateKey: () => true,
    });

    await expect(provider.generate(request, context(events))).rejects.toMatchObject({ code: 'invalid-key' });
    expect(fetch).toHaveBeenCalledOnce();
    expect(events.some(event => event.type === 'key-rotation')).toBe(false);
  });

  it('usa o maior prazo entre backoff e minDelay sem somá-los', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 }))
      .mockResolvedValueOnce(successGemini());
    const provider = new GeminiProvider({
      scheduler, clock, fetch, getKeys: () => ['valid-key'], getModel: () => 'gemini-test',
      validateKey: () => true, maxRetries: 1,
    });

    await provider.generate(request, context([]));
    expect(clock.value).toBe(15000);
    expect(clock.sleeps).toEqual([15000]);
  });

  it('completa somente a janela restante quando Retry-After é menor', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'rate limit' } }), {
        status: 429, headers: { 'retry-after': '2' },
      }))
      .mockResolvedValueOnce(successGemini());
    const provider = new GeminiProvider({
      scheduler, clock, fetch, getKeys: () => ['valid-key'], getModel: () => 'gemini-test',
      validateKey: () => true, maxRetries: 1,
    });

    await provider.generate(request, context([]));
    expect(clock.value).toBe(4500);
    expect(clock.sleeps).toEqual([2000, 2500]);
  });

  it('faz Retry-After absoluto prevalecer e suporta Mistral no mesmo contrato', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 4500, clock });
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'rate limit' }), {
        status: 429, headers: { 'retry-after': 'Thu, 01 Jan 1970 00:00:30 GMT' },
      }))
      .mockResolvedValueOnce(successMistral());
    const provider = new MistralProvider({
      scheduler, clock, fetch, getKeys: () => ['mistral-key-with-enough-length'],
      model: 'mistral-test', maxRetries: 1,
    });

    await provider.generate(request, { ...context([]), provider: 'mistral' });
    expect(clock.value).toBe(30000);
    expect(clock.sleeps).toEqual([30000]);
  });

  it('cancela durante backoff sem enviar outra requisição', async () => {
    const controller = new AbortController();
    const clock = {
      now: () => 0,
      sleep: vi.fn(async (_ms, signal) => {
        controller.abort();
        const error = new Error('Aborted');
        error.name = 'AbortError';
        if (signal.aborted) throw error;
      }),
    };
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 }));
    const provider = new GeminiProvider({
      scheduler, clock, fetch, getKeys: () => ['valid-key'], getModel: () => 'gemini-test',
      validateKey: () => true, maxRetries: 1,
    });

    await expect(provider.generate(request, {
      provider: 'gemini', signal: controller.signal, emit: () => {},
    })).rejects.toMatchObject({ name: 'AbortError', code: 'aborted' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('permite que duas instâncias compartilhem o mesmo scheduler', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 100, clock });
    const starts = [];
    const provider = () => new GeminiProvider({
      scheduler, clock,
      fetch: vi.fn(async () => { starts.push(clock.now()); return successGemini(); }),
      getKeys: () => ['valid-key'], getModel: () => 'gemini-test', validateKey: () => true,
    });

    await Promise.all([
      provider().generate(request, context([])),
      provider().generate(request, context([])),
    ]);
    expect(starts).toEqual([0, 100]);
  });

  it('não deixa um retry em backoff bloquear outra chamada pronta', async () => {
    let releaseBackoff;
    const backoff = new Promise(resolve => { releaseBackoff = resolve; });
    const clock = {
      now: () => 0,
      sleep: vi.fn(() => backoff),
    };
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const retryFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'rate limit' } }), { status: 429 }))
      .mockResolvedValueOnce(successGemini());
    const readyFetch = vi.fn().mockResolvedValue(successGemini());
    const makeProvider = fetch => new GeminiProvider({
      scheduler, clock, fetch, getKeys: () => ['valid-key'], getModel: () => 'gemini-test',
      validateKey: () => true, maxRetries: 1,
    });

    const retrying = makeProvider(retryFetch).generate(request, context([]));
    await vi.waitFor(() => expect(clock.sleep).toHaveBeenCalledWith(15000, expect.any(AbortSignal)));

    await expect(makeProvider(readyFetch).generate(request, context([]))).resolves.toMatchObject({ text: 'ficha' });
    expect(readyFetch).toHaveBeenCalledOnce();
    expect(retryFetch).toHaveBeenCalledOnce();

    releaseBackoff();
    await expect(retrying).resolves.toMatchObject({ text: 'ficha' });
    expect(retryFetch).toHaveBeenCalledTimes(2);
  });
});
