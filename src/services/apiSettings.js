import { GEMINI_DEFAULT_MODEL } from '../config.js';
import {
  AI_PROVIDER_NAMES,
  DEFAULT_AGENT_PROVIDERS,
  getDefaultModel,
  isProviderName,
  isSupportedModel,
} from '../ai/modelCatalog.js';
import { UserAccess } from './userAccess.js';

const KEYS = Object.freeze({
  geminiPrimary: 'gemini_key',
  geminiFallback2: 'fastseo_apiKey2',
  geminiFallback3: 'fastseo_apiKey3',
  mistralPrimary: 'mistral_key',
  mistralFallback2: 'fastseo_mistralKey2',
  groqPrimary: 'fastseo_groqKey',
  groqFallback2: 'fastseo_groqKey2',
  model: 'fastseo_gemini_model',
});

const agentProviderKey = stage => `fastseo_agent_${stage}_provider`;
const agentModelKey = (stage, provider) => `fastseo_agent_${stage}_${provider}_model`;

function currentUser() {
  return UserAccess.current()?.user || null;
}

function scopedKey(key) {
  const uid = currentUser()?.uid;
  return uid ? `fastseo_byok:${uid}:${key}` : '';
}

function read(key) {
  try {
    const storageKey = scopedKey(key);
    if (!storageKey) return '';

    const scopedValue = localStorage.getItem(storageKey);
    if (scopedValue) return scopedValue;

    // Migra uma única vez as chaves da versão antiga. A migração é limitada a
    // administradores para não entregar uma chave legada a outro perfil local.
    const user = currentUser();
    if (!['owner', 'admin'].includes(user?.role)) return '';
    const legacyValue = localStorage.getItem(key) || '';
    if (legacyValue) {
      localStorage.setItem(storageKey, legacyValue);
      localStorage.removeItem(key);
    }
    return legacyValue;
  }
  catch { return ''; }
}

function write(key, value) {
  try {
    const storageKey = scopedKey(key);
    if (!storageKey) return;
    const normalized = String(value || '').trim();
    if (normalized) localStorage.setItem(storageKey, normalized);
    else localStorage.removeItem(storageKey);
  } catch { /* O navegador pode bloquear armazenamento; a sessão continua. */ }
}

/**
 * Configuração BYOK isolada pelo UID autenticado. As chaves nunca são enviadas
 * ao backend do FastSEO; são lidas apenas para a chamada direta ao provedor.
 */
export const ApiSettings = Object.freeze({
  getGeminiPrimary: () => read(KEYS.geminiPrimary),
  setGeminiPrimary: value => write(KEYS.geminiPrimary, value),
  getMistralPrimary: () => read(KEYS.mistralPrimary),
  setMistralPrimary: value => write(KEYS.mistralPrimary, value),
  getGroqPrimary: () => read(KEYS.groqPrimary),
  setGroqPrimary: value => write(KEYS.groqPrimary, value),
  getModel: () => read(KEYS.model) || GEMINI_DEFAULT_MODEL,
  setModel: value => write(KEYS.model, value || GEMINI_DEFAULT_MODEL),
  getGeminiKeys: () => [read(KEYS.geminiPrimary), read(KEYS.geminiFallback2), read(KEYS.geminiFallback3)],
  getMistralKeys: () => [read(KEYS.mistralPrimary), read(KEYS.mistralFallback2)],
  getGroqKeys: () => [read(KEYS.groqPrimary), read(KEYS.groqFallback2)],
  getProviderKeys(provider) {
    if (provider === 'gemini') return this.getGeminiKeys();
    if (provider === 'mistral') return this.getMistralKeys();
    if (provider === 'groq') return this.getGroqKeys();
    return [];
  },
  getAgentProvider(stage) {
    const saved = read(agentProviderKey(stage));
    return isProviderName(saved) ? saved : DEFAULT_AGENT_PROVIDERS[stage] || 'gemini';
  },
  setAgentProvider(stage, provider) {
    if (isProviderName(provider)) write(agentProviderKey(stage), provider);
  },
  getAgentModel(stage, provider = this.getAgentProvider(stage)) {
    const saved = read(agentModelKey(stage, provider));
    if (isSupportedModel(provider, saved)) return saved;
    if (provider === 'gemini') {
      const legacy = read(KEYS.model) || GEMINI_DEFAULT_MODEL;
      if (isSupportedModel('gemini', legacy)) return legacy;
    }
    return getDefaultModel(provider);
  },
  setAgentModel(stage, provider, model) {
    if (!isProviderName(provider) || !isSupportedModel(provider, model)) return;
    write(agentModelKey(stage, provider), model);
    // Consumidores administrativos de callGemini continuam usando a escolha do A2.
    if (stage === 2 && provider === 'gemini') write(KEYS.model, model);
  },
  getAgentRoute(stage) {
    const provider = this.getAgentProvider(stage);
    return {
      provider,
      models: Object.fromEntries(AI_PROVIDER_NAMES.map(name => [name, this.getAgentModel(stage, name)])),
    };
  },
  getAgentRoutes() {
    return [1, 2, 3].map(stage => ({ stage, ...this.getAgentRoute(stage) }));
  },
  setFallback(inputId, value) {
    const storageKey = ({
      apiKey2: KEYS.geminiFallback2,
      apiKey3: KEYS.geminiFallback3,
      mistralKey2: KEYS.mistralFallback2,
      groqKey2: KEYS.groqFallback2,
    })[inputId];
    if (storageKey) write(storageKey, value);
  },
  getFallback(inputId) {
    const storageKey = ({
      apiKey2: KEYS.geminiFallback2,
      apiKey3: KEYS.geminiFallback3,
      mistralKey2: KEYS.mistralFallback2,
      groqKey2: KEYS.groqFallback2,
    })[inputId];
    return storageKey ? read(storageKey) : '';
  },
});
