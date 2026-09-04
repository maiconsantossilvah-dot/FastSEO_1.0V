import { ProviderRuntimeError, normalizeProviderError } from '../errors.js';
import { groqErrorMessage, parseGroqResponse } from '../parsers.js';
import {
  isDailyQuota,
  isOverloaded,
  requestWithRetry,
  safeEmit,
  safeJson,
  shouldRotateKey,
} from './providerSupport.js';

function uniqueKeys(values) {
  return values
    .map(value => String(value || '').trim())
    .filter((value, index, all) => value.startsWith('gsk_') && value.length > 20 && all.indexOf(value) === index);
}

export class GroqProvider {
  /**
   * @param {{
   *  scheduler: import('../contracts.js').ProviderScheduler,
   *  clock: import('../contracts.js').RuntimeClock,
   *  fetch: typeof globalThis.fetch,
   *  getKeys: () => string[],
   *  defaultModel: string,
   *  maxRetries?: number
   * }} dependencies
   */
  constructor(dependencies) {
    this.scheduler = dependencies.scheduler;
    this.clock = dependencies.clock;
    this.fetch = dependencies.fetch;
    this.getKeys = dependencies.getKeys;
    this.defaultModel = dependencies.defaultModel;
    this.maxRetries = dependencies.maxRetries ?? 1;
  }

  keys() {
    return uniqueKeys(this.getKeys());
  }

  isAvailable() {
    return this.keys().length > 0;
  }

  async generate(request, suppliedContext) {
    const context = { ...suppliedContext, provider: 'groq' };
    const keys = this.keys();
    if (!keys.length) {
      throw new ProviderRuntimeError('API Key da Groq não configurada.', {
        code: 'invalid-key', provider: 'groq', retryable: false, fallbackEligible: false,
      });
    }

    for (let index = 0; index < keys.length; index += 1) {
      try {
        return await this._generateWithKey(keys[index], request, context);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'groq');
        if (normalized.code === 'aborted') throw normalized;
        if (!normalized.providerWide && shouldRotateKey(normalized.code) && index < keys.length - 1) {
          safeEmit(context, {
            type: 'key-rotation', provider: 'groq',
            fromKeyIndex: index + 1, toKeyIndex: index + 2, reason: normalized.code,
          });
          continue;
        }
        throw normalized;
      }
    }

    throw new ProviderRuntimeError('Groq indisponível.', {
      code: 'unknown', provider: 'groq', retryable: false, fallbackEligible: false,
    });
  }

  async _generateWithKey(key, request, context) {
    const model = String(request.model || this.defaultModel || '').trim();
    if (!model) {
      throw new ProviderRuntimeError('Modelo Groq não configurado.', {
        code: 'invalid-response', provider: 'groq', retryable: false, fallbackEligible: false,
      });
    }

    const body = JSON.stringify({
      model,
      max_completion_tokens: request.maxTokens,
      temperature: request.jsonMode ? 0 : 0.3,
      reasoning_effort: 'low',
      ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.userMessage },
      ],
    });

    const response = await requestWithRetry({
      provider: 'groq', scheduler: this.scheduler, clock: this.clock, context,
      maxRetries: this.maxRetries, errorMessage: groqErrorMessage,
      fetcher: () => this.fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        signal: context.signal,
        body,
      }),
    });

    if (!response.ok) {
      const rawError = await safeJson(response);
      const message = groqErrorMessage(rawError);
      if ([401, 403].includes(response.status)) {
        throw new ProviderRuntimeError('API Key da Groq inválida. Verifique em console.groq.com.', {
          code: 'invalid-key', provider: 'groq', retryable: false, fallbackEligible: false,
        });
      }
      if (isDailyQuota(message)) {
        throw new ProviderRuntimeError('Cota diária da Groq esgotada.', {
          code: 'daily-quota', provider: 'groq', retryable: false, fallbackEligible: true,
        });
      }
      if (isOverloaded(message)) {
        throw new ProviderRuntimeError(message || 'Groq temporariamente indisponível.', {
          code: 'overloaded', provider: 'groq', retryable: false, fallbackEligible: true,
        });
      }
      throw new ProviderRuntimeError(`Groq: ${message || `HTTP ${response.status}`}`, {
        code: 'unknown', provider: 'groq', retryable: false, fallbackEligible: false,
      });
    }

    const raw = await safeJson(response);
    const result = parseGroqResponse(raw, model);
    safeEmit(context, { type: 'usage', usage: result.usage });
    return result;
  }
}
