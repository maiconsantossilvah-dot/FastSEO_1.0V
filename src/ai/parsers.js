import { ProviderRuntimeError } from './errors.js';

/** @param {unknown} value */
function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/**
 * @param {Record<string, unknown>} source
 * @param {string} key
 * @param {import('./contracts.js').ProviderName} provider
 */
function tokenValue(source, key, provider) {
  const value = source[key];
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalidResponse(provider, `Metadado de tokens inválido: ${key}.`);
  }
  return Math.round(value);
}

/**
 * @param {import('./contracts.js').ProviderName} provider
 * @param {string} message
 */
function invalidResponse(provider, message) {
  return new ProviderRuntimeError(message, {
    code: 'invalid-response', provider, retryable: false, fallbackEligible: false,
  });
}

/**
 * @param {unknown} raw
 * @param {string} [fallbackModel]
 * @returns {import('./contracts.js').ProviderResult}
 */
export function parseGeminiResponse(raw, fallbackModel = '') {
  if (!isRecord(raw)) throw invalidResponse('gemini', 'Resposta inválida do Gemini.');
  const candidates = raw.candidates;
  const candidate = Array.isArray(candidates) && isRecord(candidates[0]) ? candidates[0] : null;
  const content = candidate && isRecord(candidate.content) ? candidate.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : null;
  const firstPart = parts && isRecord(parts[0]) ? parts[0] : null;
  const text = typeof firstPart?.text === 'string' ? firstPart.text.trim() : '';
  if (!text) throw invalidResponse('gemini', 'Resposta vazia do Gemini.');

  const model = typeof raw.modelVersion === 'string' && raw.modelVersion.trim()
    ? raw.modelVersion.trim()
    : String(fallbackModel || '').trim();
  if (!model) throw invalidResponse('gemini', 'Modelo ausente na resposta do Gemini.');

  const metadata = isRecord(raw.usageMetadata) ? raw.usageMetadata : {};
  const inputTokens = tokenValue(metadata, 'promptTokenCount', 'gemini');
  const outputTokens = tokenValue(metadata, 'candidatesTokenCount', 'gemini');
  const thinkingTokens = tokenValue(metadata, 'thoughtsTokenCount', 'gemini');
  const cachedTokens = tokenValue(metadata, 'cachedContentTokenCount', 'gemini');
  const reportedTotal = tokenValue(metadata, 'totalTokenCount', 'gemini');

  return {
    text,
    usage: {
      provider: 'gemini', model, inputTokens, outputTokens, thinkingTokens, cachedTokens,
      totalTokens: reportedTotal || inputTokens + outputTokens + thinkingTokens,
    },
  };
}

/**
 * @param {unknown} raw
 * @param {string} [fallbackModel]
 * @returns {import('./contracts.js').ProviderResult}
 */
export function parseMistralResponse(raw, fallbackModel = '') {
  if (!isRecord(raw)) throw invalidResponse('mistral', 'Resposta inválida da Mistral.');
  const choices = raw.choices;
  const choice = Array.isArray(choices) && isRecord(choices[0]) ? choices[0] : null;
  const message = choice && isRecord(choice.message) ? choice.message : null;
  const text = typeof message?.content === 'string' ? message.content.trim() : '';
  if (!text) throw invalidResponse('mistral', 'Resposta vazia da Mistral.');

  const model = typeof raw.model === 'string' && raw.model.trim()
    ? raw.model.trim()
    : String(fallbackModel || '').trim();
  if (!model) throw invalidResponse('mistral', 'Modelo ausente na resposta da Mistral.');

  const usage = isRecord(raw.usage) ? raw.usage : {};
  const details = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {};
  const inputTokens = tokenValue(usage, 'prompt_tokens', 'mistral');
  const outputTokens = tokenValue(usage, 'completion_tokens', 'mistral');
  const cachedTokens = tokenValue(details, 'cached_tokens', 'mistral');
  const reportedTotal = tokenValue(usage, 'total_tokens', 'mistral');

  return {
    text,
    usage: {
      provider: 'mistral', model, inputTokens, outputTokens, thinkingTokens: 0, cachedTokens,
      totalTokens: reportedTotal || inputTokens + outputTokens,
    },
  };
}

/** @param {unknown} raw */
export function geminiErrorMessage(raw) {
  if (!isRecord(raw) || !isRecord(raw.error)) return '';
  return typeof raw.error.message === 'string' ? raw.error.message : '';
}

/** @param {unknown} raw */
export function mistralErrorMessage(raw) {
  if (!isRecord(raw)) return '';
  return typeof raw.message === 'string' ? raw.message : '';
}
