import { GEMINI_DEFAULT_MODEL, GROQ_DEFAULT_MODEL, MISTRAL_MODEL } from '../config.js';

export const AI_PROVIDER_NAMES = Object.freeze(['gemini', 'mistral', 'groq']);

export const AI_PROVIDERS = Object.freeze({
  gemini: Object.freeze({
    label: 'Gemini',
    models: Object.freeze([
      Object.freeze({ id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', hint: 'Maior cota gratuita e menor custo de tokens.' }),
      Object.freeze({ id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', hint: 'Mais qualidade, com cota gratuita intermediária.' }),
      Object.freeze({ id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', hint: 'Mais raciocínio, mas somente 100 requisições gratuitas por dia.' }),
    ]),
    defaultModel: GEMINI_DEFAULT_MODEL,
  }),
  mistral: Object.freeze({
    label: 'Mistral',
    models: Object.freeze([
      Object.freeze({ id: MISTRAL_MODEL, label: 'Mistral Medium', hint: 'Modelo legado atualmente usado pelo FastSEO.' }),
    ]),
    defaultModel: MISTRAL_MODEL,
  }),
  groq: Object.freeze({
    label: 'Groq',
    models: Object.freeze([
      Object.freeze({ id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', hint: 'Mais rápido e leve; indicado para formatação simples.' }),
      Object.freeze({ id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', hint: 'Maior qualidade; recomendado para QA e produtos complexos.' }),
    ]),
    defaultModel: GROQ_DEFAULT_MODEL,
  }),
});

export const DEFAULT_AGENT_PROVIDERS = Object.freeze({ 1: 'mistral', 2: 'gemini', 3: 'gemini' });

export function isProviderName(value) {
  return AI_PROVIDER_NAMES.includes(String(value || '').toLowerCase());
}

export function providerLabel(provider) {
  return AI_PROVIDERS[provider]?.label || 'IA';
}

export function getProviderModels(provider) {
  return AI_PROVIDERS[provider]?.models || [];
}

export function getDefaultModel(provider) {
  return AI_PROVIDERS[provider]?.defaultModel || '';
}

export function isSupportedModel(provider, model) {
  return getProviderModels(provider).some(item => item.id === model);
}

export function getModelDefinition(provider, model) {
  return getProviderModels(provider).find(item => item.id === model) || null;
}
