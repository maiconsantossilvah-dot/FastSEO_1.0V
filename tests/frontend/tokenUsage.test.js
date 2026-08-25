import { describe, expect, it } from 'vitest';
import {
  addTokenCall,
  createTokenUsage,
  formatTokenCount,
  getStageTokenUsage,
} from '../../src/modules/tokenUsage.js';

describe('tokenUsage', () => {
  it('calcula o total quando o provedor não o informa', () => {
    const summary = createTokenUsage({
      calls: [{ stage: 1, inputTokens: 100, outputTokens: 20, thinkingTokens: 5 }],
    });

    expect(summary).toMatchObject({
      inputTokens: 100,
      outputTokens: 20,
      thinkingTokens: 5,
      totalTokens: 125,
      requestCount: 1,
    });
  });

  it('acumula chamadas e separa o consumo por etapa', () => {
    const summary = createTokenUsage();
    addTokenCall(summary, 1, { inputTokens: 80, outputTokens: 20, provider: 'Gemini' });
    addTokenCall(summary, 2, { inputTokens: 90, outputTokens: 10, provider: 'Mistral' });

    expect(summary.totalTokens).toBe(200);
    expect(summary.requestCount).toBe(2);
    expect(getStageTokenUsage(summary, 2).totalTokens).toBe(100);
  });

  it('ignora contagens negativas, inválidas e chamadas vazias', () => {
    const summary = createTokenUsage({
      calls: [{ inputTokens: -10 }, { outputTokens: 'inválido' }],
    });

    expect(summary.calls).toEqual([]);
    expect(summary.totalTokens).toBe(0);
  });

  it('formata valores no padrão brasileiro', () => {
    expect(formatTokenCount(15842)).toBe('15.842');
  });
});
