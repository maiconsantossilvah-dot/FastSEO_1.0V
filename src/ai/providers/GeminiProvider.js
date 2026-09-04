import { ProviderRuntimeError, normalizeProviderError } from '../errors.js';
import { geminiErrorMessage, parseGeminiResponse } from '../parsers.js';
import {
  isDailyQuota,
  isOverloaded,
  requestWithRetry,
  safeEmit,
  safeJson,
  shouldRotateKey,
} from './providerSupport.js';

function uniqueKeys(values, validateKey) {
  return values
    .map(value => String(value || '').trim())
    .filter((value, index, all) => validateKey(value) && all.indexOf(value) === index);
}

export class GeminiProvider {
  /**
   * @param {{
   *  scheduler: import('../contracts.js').ProviderScheduler,
   *  clock: import('../contracts.js').RuntimeClock,
   *  fetch: typeof globalThis.fetch,
   *  getKeys: () => string[],
   *  getModel: () => string,
   *  validateKey: (key: string) => boolean,
   *  maxRetries?: number
   * }} dependencies
   */
  constructor(dependencies) {
    this.scheduler = dependencies.scheduler;
    this.clock = dependencies.clock;
    this.fetch = dependencies.fetch;
    this.getKeys = dependencies.getKeys;
    this.getModel = dependencies.getModel;
    this.validateKey = dependencies.validateKey;
    this.maxRetries = dependencies.maxRetries ?? 2;
  }

  keys() {
    return uniqueKeys(this.getKeys(), this.validateKey);
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
    const context = { ...suppliedContext, provider: 'gemini' };
    const keys = this.keys();
    if (!keys.length) {
      throw new ProviderRuntimeError('API Key do Gemini não configurada.', {
        code: 'invalid-key', provider: 'gemini', retryable: false, fallbackEligible: false,
      });
    }

    for (let index = 0; index < keys.length; index += 1) {
      try {
        return await this._generateWithKey(keys[index], request, context);
      } catch (error) {
        const normalized = normalizeProviderError(error, 'gemini');
        if (normalized.code === 'aborted') throw normalized;
        if (!normalized.providerWide && shouldRotateKey(normalized.code) && index < keys.length - 1) {
          safeEmit(context, {
            type: 'key-rotation', provider: 'gemini',
            fromKeyIndex: index + 1, toKeyIndex: index + 2, reason: normalized.code,
          });
          continue;
        }
        throw normalized;
      }
    }

    throw new ProviderRuntimeError('Gemini indisponível.', {
      code: 'unknown', provider: 'gemini', retryable: false, fallbackEligible: false,
    });
  }

  async _generateWithKey(key, request, context) {
    const model = String(request.model || this.getModel() || '').trim();
    if (!model) {
      throw new ProviderRuntimeError('Modelo Gemini não configurado.', {
        code: 'invalid-response', provider: 'gemini', retryable: false, fallbackEligible: false,
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body = JSON.stringify({
      system_instruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.userMessage }] }],
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        ...(request.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });

    const response = await requestWithRetry({
      provider: 'gemini', scheduler: this.scheduler, clock: this.clock, context,
      maxRetries: this.maxRetries, errorMessage: geminiErrorMessage,
      fetcher: () => this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        signal: context.signal,
        body,
      }),
    });

    if (!response.ok) {
      const rawError = await safeJson(response);
      const message = geminiErrorMessage(rawError);
      if ([400, 401, 403].includes(response.status)) {
        throw new ProviderRuntimeError('API Key do Gemini inválida. Verifique em aistudio.google.com.', {
          code: 'invalid-key', provider: 'gemini', retryable: false, fallbackEligible: false,
        });
      }
      if (isDailyQuota(message)) {
        throw new ProviderRuntimeError('Cota diária do Gemini esgotada.', {
          code: 'daily-quota', provider: 'gemini', retryable: false, fallbackEligible: true,
        });
      }
      if (isOverloaded(message)) {
        throw new ProviderRuntimeError(message || 'Gemini temporariamente indisponível.', {
          code: 'overloaded', provider: 'gemini', retryable: false, fallbackEligible: true,
        });
      }
      throw new ProviderRuntimeError(`Gemini: ${message || `HTTP ${response.status}`}`, {
        code: 'unknown', provider: 'gemini', retryable: false, fallbackEligible: false,
      });
    }

    const raw = await safeJson(response);
    const result = parseGeminiResponse(raw, model);
    safeEmit(context, { type: 'usage', usage: result.usage });
    return result;
  }
}
