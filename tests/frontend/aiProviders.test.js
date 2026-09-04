import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../../src/ai/providers/GeminiProvider.js';
import { MistralProvider } from '../../src/ai/providers/MistralProvider.js';
import { GroqProvider } from '../../src/ai/providers/GroqProvider.js';
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
const successGroq = () => new Response(JSON.stringify({
  model: 'openai/gpt-oss-120b', choices: [{ message: { content: 'ficha groq' } }],
  usage: { prompt_tokens: 11, completion_tokens: 4, total_tokens: 15 },
}), { status: 200, headers: { 'content-type': 'application/json' } });
const context = events => ({ provider: 'gemini', signal: new AbortController().signal, emit: event => events.push(event) });

describe('providers de IA', () => {
  it('envia o modelo escolhido pelo agente para a Groq e contabiliza o uso', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const fetch = vi.fn().mockResolvedValue(successGroq());
    const events = [];
    const provider = new GroqProvider({
      scheduler, clock, fetch,
      getKeys: () => ['gsk_key-with-enough-length-for-tests'],
      defaultModel: 'openai/gpt-oss-20b',
    });

    await expect(provider.generate(
      { ...request, model: 'openai/gpt-oss-120b', jsonMode: true },
      { ...context(events), provider: 'groq' },
    )).resolves.toMatchObject({ text: 'ficha groq', usage: { provider: 'groq', totalTokens: 15 } });

    const [, init] = fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'openai/gpt-oss-120b',
      max_completion_tokens: 100,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
    });
    expect(body).not.toHaveProperty('max_tokens');
    expect(init.headers.Authorization).toBe('Bearer gsk_key-with-enough-length-for-tests');
    expect(events).toContainEqual(expect.objectContaining({ type: 'usage', usage: { provider: 'groq', model: 'openai/gpt-oss-120b', inputTokens: 11, outputTokens: 4, thinkingTokens: 0, cachedTokens: 0, totalTokens: 15 } }));
  });

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

  it('faz fallback imediato quando o Free Tier da Mistral está desativado', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'The Free Tier is temporarily disabled due to high load.',
    }), { status: 429 }));
    const provider = new MistralProvider({
      scheduler, clock, fetch, getKeys: () => [
        'mistral-key-with-enough-length',
        'second-mistral-key-with-enough-length',
      ],
      model: 'mistral-test',
    });

    await expect(provider.generate(request, { ...context([]), provider: 'mistral' }))
      .rejects.toMatchObject({ code: 'overloaded', fallbackEligible: true, providerWide: true });
    expect(fetch).toHaveBeenCalledOnce();
    expect(clock.sleeps).toEqual([]);
  });

  it('limita um 429 genérico da Mistral a somente um retry por padrão', async () => {
    const clock = new FakeClock();
    const scheduler = new RateLimitScheduler({ minDelayMs: 0, clock });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'rate limit' }), { status: 429 }));
    const provider = new MistralProvider({
      scheduler, clock, fetch, getKeys: () => ['mistral-key-with-enough-length'],
      model: 'mistral-test',
    });

    await expect(provider.generate(request, { ...context([]), provider: 'mistral' }))
      .rejects.toMatchObject({ code: 'rate-limit', fallbackEligible: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(clock.sleeps).toEqual([15000]);
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
