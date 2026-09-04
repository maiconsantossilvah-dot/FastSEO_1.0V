// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn().mockRejectedValue(Object.assign(new Error('offline'), { status: 500 }));

vi.mock('../../src/services/userAccess.js', () => ({
  UserAccess: {
    current: () => ({ user: { uid: 'user-groq' } }),
    request,
  },
}));

const { UsageAnalytics } = await import('../../src/services/usageAnalytics.js');

describe('telemetria de uso do frontend', () => {
  beforeEach(() => {
    localStorage.clear();
    request.mockClear();
  });

  it('mantém chamadas Groq na fila enviada ao backend', () => {
    expect(UsageAnalytics.record({
      status: 'aprovado',
      durationMs: 1000,
      calls: [{
        stage: 1,
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        kind: 'generation',
        inputTokens: 100,
        outputTokens: 20,
        thinkingTokens: 5,
        cachedTokens: 0,
        totalTokens: 125,
      }],
    })).toBe(true);

    const queued = JSON.parse(localStorage.getItem('fastseo_usage_queue_v1'));
    expect(queued[0].calls[0]).toMatchObject({
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      totalTokens: 125,
    });
  });
});
