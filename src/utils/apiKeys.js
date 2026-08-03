/**
 * Aceita os dois formatos emitidos para a Gemini API:
 * - AIza...: chave Standard (legada)
 * - AQ....: chave de autorização (nova)
 */
export function isValidGeminiKey(key) {
  const value = String(key || '').trim();
  return value.length > 20 && (value.startsWith('AIza') || value.startsWith('AQ.'));
}
