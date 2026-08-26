import { GEMINI_DEFAULT_MODEL } from '../config.js';
import { UserAccess } from './userAccess.js';

const KEYS = Object.freeze({
  geminiPrimary: 'gemini_key',
  geminiFallback2: 'fastseo_apiKey2',
  geminiFallback3: 'fastseo_apiKey3',
  mistralPrimary: 'mistral_key',
  mistralFallback2: 'fastseo_mistralKey2',
  model: 'fastseo_gemini_model',
});

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
  getModel: () => read(KEYS.model) || GEMINI_DEFAULT_MODEL,
  setModel: value => write(KEYS.model, value || GEMINI_DEFAULT_MODEL),
  getGeminiKeys: () => [read(KEYS.geminiPrimary), read(KEYS.geminiFallback2), read(KEYS.geminiFallback3)],
  getMistralKeys: () => [read(KEYS.mistralPrimary), read(KEYS.mistralFallback2)],
  setFallback(inputId, value) {
    const storageKey = ({
      apiKey2: KEYS.geminiFallback2,
      apiKey3: KEYS.geminiFallback3,
      mistralKey2: KEYS.mistralFallback2,
    })[inputId];
    if (storageKey) write(storageKey, value);
  },
  getFallback(inputId) {
    const storageKey = ({
      apiKey2: KEYS.geminiFallback2,
      apiKey3: KEYS.geminiFallback3,
      mistralKey2: KEYS.mistralFallback2,
    })[inputId];
    return storageKey ? read(storageKey) : '';
  },
});
