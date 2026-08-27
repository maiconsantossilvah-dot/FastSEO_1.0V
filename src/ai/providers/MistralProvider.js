import { ProviderRuntimeError, normalizeProviderError } from '../errors.js';
import { mistralErrorMessage, parseMistralResponse } from '../parsers.js';
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
    .filter((value, index, all) => value.length > 20 && all.indexOf(value) === index);
}

export class MistralProvider {
  /**
   * @param {{
   *  scheduler: import('../contracts.js').ProviderScheduler,
   *  clock: import('../contracts.js').RuntimeClock,
   *  fetch: typeof globalThis.fetch,
   *  getKeys: () => string[],
   *  model: string,
   *  maxRetries?: number
   * }} dependencies
   */
  constructor(dependencies) {
    this.scheduler = dependencies.scheduler;
    this.clock = dependencies.clock;
    this.fetch = dependencies.fetch;
    this.getKeys = dependencies.getKeys;
    this.model = dependencies.model;
    this.maxRetries = dependencies.maxRetries ?? 5;
  }

  keys() {
    return uniqueKeys(this.getKeys());
  }

  isAvailable() {
    return this.keys().length > 0;
  }

  /**
   * @param {import('../contracts.js').ProviderRequest} request
   * @param {import('../contracts.js').ProviderContext} suppliedContext
   * @returns {Promise<import('../contracts.js').ProviderResult>}
   */
  async generate(request, suppliedContext) {
    const context = { ...suppliedContext, provider: 'mistral' };
    const keys = this.keys();
    if (!keys.length) {
      throw new ProviderRuntimeError('API Key da Mistral não configurada.', {
        code: 'invalid-key', provider: 'mistral', retryable: false, fallbackEligible: false,
      });
    }

    for (let index = 0; index < keys.length; index += 1) {
      try {
        return await this._generateWithKey(keys[index], request, context);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'mistral');
        if (normalized.code === 'aborted') throw normalized;
        if (shouldRotateKey(normalized.code) && index < keys.length - 1) {
          safeEmit(context, {
            type: 'key-rotation', provider: 'mistral',
            fromKeyIndex: index + 1, toKeyIndex: index + 2, reason: normalized.code,
          });
          continue;
        }
        throw normalized;
      }
    }

    throw new ProviderRuntimeError('Mistral indisponível.', {
      code: 'unknown', provider: 'mistral', retryable: false, fallbackEligible: false,
    });
  }

  async _generateWithKey(key, request, context) {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: request.maxTokens,
      temperature: request.jsonMode ? 0 : 0.3,
      ...(request.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.userMessage },
      ],
    });

    const response = await requestWithRetry({
      provider: 'mistral', scheduler: this.scheduler, clock: this.clock, context,
      maxRetries: this.maxRetries, errorMessage: mistralErrorMessage,
      fetcher: () => this.fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        signal: context.signal,
        body,
      }),
    });

    if (!response.ok) {
      const rawError = await safeJson(response);
      const message = mistralErrorMessage(rawError);
      if (response.status === 401) {
        throw new ProviderRuntimeError('API Key da Mistral inválida. Verifique em console.mistral.ai.', {
          code: 'invalid-key', provider: 'mistral', retryable: false, fallbackEligible: false,
        });
      }
      if (isDailyQuota(message)) {
        throw new ProviderRuntimeError('Cota diária da Mistral esgotada.', {
          code: 'daily-quota', provider: 'mistral', retryable: false, fallbackEligible: true,
        });
      }
      if (isOverloaded(message)) {
        throw new ProviderRuntimeError(message || 'Mistral temporariamente indisponível.', {
          code: 'overloaded', provider: 'mistral', retryable: false, fallbackEligible: true,
        });
      }
      throw new ProviderRuntimeError(`Mistral: ${message || `HTTP ${response.status}`}`, {
        code: 'unknown', provider: 'mistral', retryable: false, fallbackEligible: false,
      });
    }

    const raw = await safeJson(response);
    const result = parseMistralResponse(raw, this.model);
    safeEmit(context, { type: 'usage', usage: result.usage });
    return result;
  }
}
