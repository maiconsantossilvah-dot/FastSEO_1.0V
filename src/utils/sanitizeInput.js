/**
 * Limpeza conservadora do texto recebido pelo pipeline.
 * Retorna metadados para que a interface possa avisar sobre truncamento sem
 * misturar a regra pura com console, DOM ou configuração global.
 */
export function sanitizeInput(value, { maxChars = Number.POSITIVE_INFINITY } = {}) {
  const original = String(value ?? '');
  let text = original
    .replace(/<[^>]+>/g, '')
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/(javascript:|data:|vbscript:)/gi, '')
    .replace(/ {3,}/g, '  ')
    .trim();

  const safeLimit = Number.isFinite(maxChars) && maxChars >= 0
    ? Math.floor(maxChars)
    : Number.POSITIVE_INFINITY;
  const truncated = text.length > safeLimit;
  if (truncated) text = text.slice(0, safeLimit);

  return {
    text,
    truncated,
    originalLength: original.length,
    sanitizedLength: text.length,
    maxChars: safeLimit,
  };
}
