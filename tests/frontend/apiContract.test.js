import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callAgent, callGemini, configureAiRuntime } from '../../src/services/api.js';

describe('contrato público de api.js', () => {
  let runtime;

  beforeEach(() => {
    runtime = {
      generateForAgent: vi.fn(async (_agent, _request, options) => {
        options.emit({
          type: 'usage',
          usage: { provider: 'gemini', model: 'test', inputTokens: 2, outputTokens: 1, thinkingTokens: 0, cachedTokens: 0, totalTokens: 3 },
        });
        return { text: 'resultado', usage: {} };
      }),
      generateWithProvider: vi.fn(async () => ({ text: 'direto', usage: {} })),
    };
    configureAiRuntime(runtime);
  });

  it('preserva texto, sinal, JSON mode e telemetria de callAgent', async () => {
    const controller = new AbortController();
    const onUsage = vi.fn();
    const onEvent = vi.fn();

    await expect(callAgent('sys', 'user', 1500, controller.signal, 2, { onUsage, onEvent })).resolves.toBe('resultado');
    const [agent, request, options] = runtime.generateForAgent.mock.calls[0];
    expect(agent).toBe(2);
    expect(request).toEqual({ system: 'sys', userMessage: 'user', maxTokens: 1500, jsonMode: true });
    expect(options.signal).toBe(controller.signal);
    expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 3 }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'usage' }));
  });

  it('mantém chamada direta ao Gemini sem fallback implícito', async () => {
    await expect(callGemini('s', 'u', 100, 1, null, { jsonMode: true })).resolves.toBe('direto');
    expect(runtime.generateWithProvider).toHaveBeenCalledWith(
      'gemini', expect.objectContaining({ jsonMode: true }), expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('preserva erros e cancelamentos produzidos pelo gateway', async () => {
    const error = new Error('falhou');
    runtime.generateForAgent.mockRejectedValueOnce(error);
    await expect(callAgent('s', 'u', 1, new AbortController().signal, 1)).rejects.toBe(error);

    const aborted = new Error('cancelado');
    aborted.name = 'AbortError';
    runtime.generateForAgent.mockRejectedValueOnce(aborted);
    await expect(callAgent('s', 'u', 1, new AbortController().signal, 1)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
