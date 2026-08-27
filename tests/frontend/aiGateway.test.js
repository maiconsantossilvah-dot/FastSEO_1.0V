import { describe, expect, it, vi } from 'vitest';
import { AiGateway } from '../../src/ai/AiGateway.js';
import { ProviderRuntimeError } from '../../src/ai/errors.js';

const result = provider => ({
  text: provider,
  usage: { provider, model: 'test', inputTokens: 1, outputTokens: 1, thinkingTokens: 0, cachedTokens: 0, totalTokens: 2 },
});
const request = { system: 's', userMessage: 'u', maxTokens: 10 };
const options = events => ({ signal: new AbortController().signal, emit: event => events.push(event) });
const fakeProvider = (name, implementation, available = true) => ({
  isAvailable: () => available,
  generate: vi.fn(implementation || (async () => result(name))),
});

describe('AiGateway', () => {
  it('escolhe Mistral no A1 e Gemini nos demais agentes', async () => {
    const providers = { gemini: fakeProvider('gemini'), mistral: fakeProvider('mistral') };
    const gateway = new AiGateway({ providers });

    await expect(gateway.generateForAgent(1, request, options([]))).resolves.toMatchObject({ text: 'mistral' });
    await expect(gateway.generateForAgent(2, request, options([]))).resolves.toMatchObject({ text: 'gemini' });
  });

  it('faz fallback somente quando o erro é elegível', async () => {
    const recoverable = new ProviderRuntimeError('quota', {
      code: 'daily-quota', provider: 'mistral', retryable: false, fallbackEligible: true,
    });
    const providers = {
      gemini: fakeProvider('gemini'),
      mistral: fakeProvider('mistral', async () => { throw recoverable; }),
    };
    const events = [];
    const gateway = new AiGateway({ providers });

    await expect(gateway.generateForAgent(1, request, options(events))).resolves.toMatchObject({ text: 'gemini' });
    expect(events).toContainEqual({
      type: 'provider-fallback', from: 'mistral', to: 'gemini', reason: 'daily-quota',
    });

    providers.mistral.generate.mockRejectedValue(new ProviderRuntimeError('key', {
      code: 'invalid-key', provider: 'mistral', retryable: false, fallbackEligible: false,
    }));
    await expect(gateway.generateForAgent(1, request, options([]))).rejects.toMatchObject({ code: 'invalid-key' });
  });

  it('nunca transforma cancelamento em fallback', async () => {
    const aborted = new ProviderRuntimeError('cancelado', {
      code: 'aborted', provider: 'mistral', retryable: false, fallbackEligible: true,
    });
    const providers = {
      gemini: fakeProvider('gemini'),
      mistral: fakeProvider('mistral', async () => { throw aborted; }),
    };
    const gateway = new AiGateway({ providers });

    await expect(gateway.generateForAgent(1, request, options([]))).rejects.toMatchObject({ name: 'AbortError' });
    expect(providers.gemini.generate).not.toHaveBeenCalled();
  });

  it('usa o alternativo quando o provedor preferido não possui chave', async () => {
    const providers = { gemini: fakeProvider('gemini'), mistral: fakeProvider('mistral', null, false) };
    const events = [];
    const gateway = new AiGateway({ providers });

    await expect(gateway.generateForAgent(1, request, options(events))).resolves.toMatchObject({ text: 'gemini' });
    expect(events[0]).toMatchObject({ type: 'provider-fallback', from: 'mistral', to: 'gemini' });
  });
});
