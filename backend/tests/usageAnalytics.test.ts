import { describe, expect, it } from 'vitest';
import { aggregateUsageEvents, type StoredUsageEvent } from '../src/usage/usage.analytics.js';
import { usageEventSchema } from '../src/usage/usage.schema.js';

const call = (stage: number, provider: 'gemini' | 'mistral', model: string, input: number, output: number) => ({
  stage,
  provider,
  model,
  kind: 'generation' as const,
  inputTokens: input,
  outputTokens: output,
  thinkingTokens: 0,
  cachedTokens: 0,
  totalTokens: input + output,
});

describe('telemetria de uso', () => {
  it('valida somente métricas sem conteúdo sensível', () => {
    expect(usageEventSchema.parse({
      eventId: '12345678-1234-4234-8234-123456789abc'.replaceAll('-', '_'),
      status: 'aprovado',
      durationMs: 1200,
      category: 'Celular',
      bivolt: false,
      calls: [call(1, 'mistral', 'mistral-large', 100, 20)],
    }).calls).toHaveLength(1);

    expect(() => usageEventSchema.parse({
      eventId: 'evento_com_tamanho_suficiente',
      status: 'aprovado',
      durationMs: 1200,
      category: 'Celular',
      bivolt: false,
      calls: [call(1, 'mistral', 'mistral-large', 100, 20)],
      prompt: 'não deve ser aceito',
    })).toThrow();
  });

  it('agrega por usuário, agente, modelo, categoria e dia', () => {
    const events: StoredUsageEvent[] = [
      {
        uid: 'u1', userEmail: 'a@fastseo.test', userDisplayName: 'Ana', status: 'aprovado',
        durationMs: 1000, category: 'Celular', createdAt: new Date('2026-08-20T12:00:00Z'),
        calls: [call(1, 'mistral', 'large', 100, 20), call(2, 'gemini', 'flash', 80, 10)],
      },
      {
        uid: 'u2', userEmail: 'b@fastseo.test', userDisplayName: 'Bia', status: 'reprovado',
        durationMs: 3000, category: 'Eletro', createdAt: new Date('2026-08-21T12:00:00Z'),
        calls: [call(1, 'mistral', 'large', 200, 40)],
      },
    ];

    const result = aggregateUsageEvents(events);
    expect(result.summary).toMatchObject({
      runs: 2,
      approved: 1,
      rejected: 1,
      approvalRate: 50,
      requests: 3,
      inputTokens: 380,
      outputTokens: 70,
      totalTokens: 450,
      averageTokensPerRun: 225,
      averageDurationMs: 2000,
    });
    expect(result.users).toHaveLength(2);
    expect(result.stages.find(stage => stage.stage === 1)?.totalTokens).toBe(360);
    expect(result.providers.find(provider => provider.provider === 'mistral')?.requests).toBe(2);
    expect(result.categories.map(category => category.category)).toEqual(['Eletro', 'Celular']);
    expect(result.daily).toHaveLength(2);
  });
});
