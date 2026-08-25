import { compactProductInput } from '../modules/outputGuards.js';
import { sanitizeInput } from './sanitizeInput.js';

/**
 * Ponto único e testável para preparar dados de produto.
 * A adoção pelo pipeline pode ser feita separadamente, depois da validação da UX
 * de avisos; por enquanto esta função não altera o fluxo em produção.
 */
export function prepareProductInput(raw, { maxChars = 20000 } = {}) {
  const sanitized = sanitizeInput(raw, { maxChars });
  const text = compactProductInput(sanitized.text);
  const warnings = sanitized.truncated
    ? [{
        code: 'INPUT_TRUNCATED',
        message: `O conteúdo excedeu ${maxChars} caracteres e foi truncado.`,
      }]
    : [];

  return {
    text,
    warnings,
    meta: {
      originalLength: sanitized.originalLength,
      preparedLength: text.length,
      truncated: sanitized.truncated,
      maxChars: sanitized.maxChars,
    },
  };
}
