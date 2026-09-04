import { describe, expect, it } from 'vitest';
import { parseGeminiResponse, parseGroqResponse, parseMistralResponse } from '../../src/ai/parsers.js';

describe('parsers do runtime de IA', () => {
  it('normaliza resposta e tokens do Gemini', () => {
    const result = parseGeminiResponse({
      modelVersion: 'gemini-test',
      candidates: [{ content: { parts: [{ text: '  ficha  ' }] } }],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 4,
        thoughtsTokenCount: 2,
        cachedContentTokenCount: 1,
        totalTokenCount: 16,
      },
    });

    expect(result).toEqual({
      text: 'ficha',
      usage: {
        provider: 'gemini', model: 'gemini-test', inputTokens: 10, outputTokens: 4,
        thinkingTokens: 2, cachedTokens: 1, totalTokens: 16,
      },
    });
  });

  it('normaliza resposta e tokens da Mistral', () => {
    const result = parseMistralResponse({
      model: 'mistral-test',
      choices: [{ message: { content: ' resultado ' } }],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
    });

    expect(result.text).toBe('resultado');
    expect(result.usage).toMatchObject({ provider: 'mistral', inputTokens: 8, outputTokens: 3, totalTokens: 11 });
  });

  it('normaliza resposta e tokens de raciocínio da Groq', () => {
    const result = parseGroqResponse({
      model: 'openai/gpt-oss-120b',
      choices: [{ message: { content: ' resultado groq ' } }],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 5,
        total_tokens: 17,
        prompt_tokens_details: { cached_tokens: 3 },
        completion_tokens_details: { reasoning_tokens: 2 },
      },
    });

    expect(result).toEqual({
      text: 'resultado groq',
      usage: {
        provider: 'groq', model: 'openai/gpt-oss-120b', inputTokens: 12, outputTokens: 3,
        thinkingTokens: 2, cachedTokens: 3, totalTokens: 17,
      },
    });
  });

  it.each([
    ['Gemini vazio', () => parseGeminiResponse({ modelVersion: 'x', candidates: [] })],
    ['Mistral incompleta', () => parseMistralResponse({ model: 'x', choices: [{}] })],
    ['Groq incompleta', () => parseGroqResponse({ model: 'x', choices: [{}] })],
    ['Gemini token inválido', () => parseGeminiResponse({
      modelVersion: 'x', candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      usageMetadata: { promptTokenCount: '10' },
    })],
    ['Mistral token negativo', () => parseMistralResponse({
      model: 'x', choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: -1 },
    })],
  ])('rejeita %s', (_label, parse) => {
    expect(parse).toThrow(expect.objectContaining({ code: 'invalid-response' }));
  });
});
