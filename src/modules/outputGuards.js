/**
 * Guardas determinísticos do pipeline.
 * Não redigem nem reorganizam a ficha: apenas normalizam ruído seguro,
 * preservam o fornecedor literal e apontam violações objetivas.
 */

function text(value) {
  return value == null ? '' : String(value);
}

function normalizeNewlines(value) {
  return text(value).replace(/\r\n?/g, '\n');
}

function supplierFrom(value) {
  const matches = [...normalizeNewlines(value).matchAll(/^\s*Fornecedor\s*:\s*(.*)$/gim)];
  return matches.length ? matches[matches.length - 1][1].trim() : '';
}

/** Limpeza conservadora: preserva todas as linhas e seus valores. */
export function compactProductInput(value) {
  const lines = normalizeNewlines(value)
    .split('\n')
    .map(line => line.replace(/[\t ]+$/g, ''));

  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const previous = result.at(-1)?.trim() || '';

    if (!trimmed && !previous) continue;
    result.push(line);
  }

  return result.join('\n').trim();
}

/**
 * Corrige apenas detalhes semântica e factualmente seguros.
 * O fornecedor é removido da posição gerada e recolocado no fim com o valor bruto.
 */
export function stabilizeFichaOutput(rawInput, generated) {
  let ficha = normalizeNewlines(generated)
    .replace(/^```(?:text|txt|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .split('\n')
    .map(line => line.replace(/[\t ]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (/^STATUS:\s*REVISÃO NECESSÁRIA/im.test(ficha)) return ficha;

  const literalSupplier = supplierFrom(rawInput);
  if (!literalSupplier) return ficha;

  ficha = ficha
    .split('\n')
    .filter(line => !/^\s*Fornecedor\s*:/i.test(line))
    .join('\n')
    .trim();

  return `${ficha}\n\nFornecedor: ${literalSupplier}`;
}

function issue(tipo, campo, motivo, bruto = '', gerado = '') {
  return { tipo, campo, bruto, gerado, motivo };
}

/** Falhas objetivas que não dependem de interpretação do produto. */
export function validateFichaOutput(rawInput, fichaInput) {
  const raw = normalizeNewlines(rawInput);
  const ficha = normalizeNewlines(fichaInput).trim();
  const errors = [];
  const warnings = [];
  const isConflictReport = /^STATUS:\s*REVISÃO NECESSÁRIA/im.test(ficha);

  if (!ficha) {
    errors.push(issue('FORMATO_INVALIDO', 'Ficha', 'O A1 retornou uma ficha vazia.'));
    return { errors, warnings };
  }

  if (/```/.test(ficha)) {
    errors.push(issue('FORMATO_INVALIDO', 'Ficha', 'A saída contém delimitador de Markdown.'));
  }

  if (/^\s*[-*•]\s+/m.test(ficha)) {
    errors.push(issue('FORMATO_INVALIDO', 'Ficha', 'A saída contém bullets, proibidos pelo contrato de formatação.'));
  }

  if (/\n{3,}/.test(ficha)) {
    warnings.push({ tipo: 'FORMATO', campo: 'Espaçamento', motivo: 'Existem linhas vazias excedentes entre blocos.' });
  }

  const rawSupplier = supplierFrom(raw);
  const generatedSupplier = supplierFrom(ficha);
  if (!isConflictReport && rawSupplier && generatedSupplier !== rawSupplier) {
    errors.push(issue(
      'FORNECEDOR_ALTERADO',
      'Fornecedor',
      'O fornecedor deve ser idêntico aos dados brutos.',
      rawSupplier,
      generatedSupplier || 'OMITIDO'
    ));
  }

  if (!isConflictReport && generatedSupplier) {
    const nonEmpty = ficha.split('\n').map(line => line.trim()).filter(Boolean);
    if (!/^Fornecedor\s*:/i.test(nonEmpty.at(-1) || '')) {
      errors.push(issue('FORMATO_INVALIDO', 'Fornecedor', 'O fornecedor deve ser a última linha da ficha.'));
    }
  }

  if (/\bGarantia\s*:/i.test(ficha) && !/\bgarantia\b/i.test(raw)) {
    errors.push(issue(
      'DADO_INVENTADO',
      'Garantia',
      'A ficha incluiu garantia sem menção literal nos dados brutos.',
      'AUSENTE',
      ficha.match(/^\s*Garantia\s*:\s*(.*)$/im)?.[1]?.trim() || 'PRESENTE'
    ));
  }

  return { errors, warnings };
}
