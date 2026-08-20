export function normalizePrivateKey(value: string | undefined): string | undefined {
  let normalized = value?.trim();
  if (!normalized) return undefined;

  if (normalized.startsWith('"') && normalized.endsWith('"')) {
    try {
      const parsed = JSON.parse(normalized);
      if (typeof parsed === 'string') normalized = parsed.trim();
    } catch {
      // Mantém o valor original para o Firebase produzir um erro de credencial claro.
    }
  } else if (normalized.startsWith("'") && normalized.endsWith("'")) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim();
}
