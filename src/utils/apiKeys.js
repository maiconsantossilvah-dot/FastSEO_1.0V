/**
 * Aceita os dois formatos emitidos para a Gemini API:
 * - AIza...: chave Standard (legada)
 * - AQ....: chave de autorização (nova)
 */
export function isValidGeminiKey(key) {
  const value = String(key || '').trim();
  return value.length > 20 && (value.startsWith('AIza') || value.startsWith('AQ.'));
}

export function isValidMistralKey(key) {
  return String(key || '').trim().length > 20;
}

export function isValidGroqKey(key) {
  const value = String(key || '').trim();
  return value.startsWith('gsk_') && value.length > 20;
}

export function isValidProviderKey(provider, key) {
  if (provider === 'gemini') return isValidGeminiKey(key);
  if (provider === 'mistral') return isValidMistralKey(key);
  if (provider === 'groq') return isValidGroqKey(key);
  return false;
}
