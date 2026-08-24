const VALID_TYPES = new Set([
  'DADO_INVENTADO',
  'DADO_OMITIDO',
  'VALOR_ALTERADO',
  'ASSOCIACAO_INCORRETA',
  'FORNECEDOR_ALTERADO',
  'CONFLITO_NA_FONTE',
  'REGRA_DA_CATEGORIA',
  'PROMESSA_SEM_FONTE',
  'VALIDACAO_INCONCLUSIVA',
  'FORMATO_INVALIDO',
  'JSON_INVALIDO',
]);

function text(value) {
  return value == null ? '' : String(value).trim();
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeError(item) {
  if (typeof item === 'string') {
    return { tipo: 'VALIDACAO_INCONCLUSIVA', campo: 'Ficha', bruto: '', gerado: '', motivo: text(item) };
  }

  const source = item && typeof item === 'object' ? item : {};
  const requestedType = text(source.tipo).toUpperCase();
  return {
    tipo: VALID_TYPES.has(requestedType) ? requestedType : 'VALIDACAO_INCONCLUSIVA',
    campo: text(source.campo) || 'Ficha',
    bruto: text(source.bruto),
    gerado: text(source.gerado ?? source.valor),
    motivo: text(source.motivo) || 'Problema identificado pelo A2.',
  };
}

function normalizeWarning(item) {
  if (typeof item === 'string') return { tipo: 'INFORMATIVO', campo: 'Ficha', motivo: text(item) };
  const source = item && typeof item === 'object' ? item : {};
  return {
    tipo: text(source.tipo).toUpperCase() || 'INFORMATIVO',
    campo: text(source.campo) || 'Ficha',
    motivo: text(source.motivo) || text(source.valor) || 'Observação do A2.',
  };
}

function normalizeConfidence(value) {
  const confidence = text(value).toUpperCase().replace('MÉDIA', 'MEDIA');
  return ['ALTA', 'MEDIA', 'BAIXA'].includes(confidence) ? confidence : 'MEDIA';
}

function normalizeQa(value) {
  const source = value && typeof value === 'object' ? value : {};
  const errors = arrayOrEmpty(source.erros).map(normalizeError);
  const warnings = arrayOrEmpty(source.avisos).map(normalizeWarning);
  let status = text(source.status).toUpperCase() === 'APROVADO' ? 'APROVADO' : 'REPROVADO';
  let confianca = normalizeConfidence(source.confianca);

  if (errors.length) {
    status = 'REPROVADO';
    if (confianca === 'ALTA') confianca = 'BAIXA';
  }

  if (status === 'APROVADO' && confianca !== 'ALTA') {
    status = 'REPROVADO';
    errors.push(normalizeError({
      tipo: 'VALIDACAO_INCONCLUSIVA',
      campo: 'Decisão do A2',
      motivo: 'Aprovação exige confiança ALTA.',
    }));
  }

  if (status === 'REPROVADO' && !errors.length) {
    errors.push(normalizeError({
      tipo: 'VALIDACAO_INCONCLUSIVA',
      campo: 'Decisão do A2',
      motivo: 'O A2 reprovou a ficha sem informar um erro objetivo.',
    }));
  }

  return {
    status,
    confianca,
    erros: errors,
    avisos: warnings,
    resumo: text(source.resumo) || (status === 'APROVADO'
      ? 'Ficha aprovada pelo A2.'
      : `${errors.length} problema(s) identificado(s) pelo A2.`),
  };
}

function stripFences(raw) {
  return text(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export function parseQAJson(raw) {
  const cleaned = stripFences(raw);

  try {
    return normalizeQa(JSON.parse(cleaned));
  } catch {}

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return normalizeQa(JSON.parse(cleaned.slice(first, last + 1)));
    } catch {}
  }

  return normalizeQa({
    status: 'REPROVADO',
    confianca: 'MEDIA',
    erros: [{
      tipo: 'JSON_INVALIDO',
      campo: 'Resposta do A2',
      bruto: '',
      gerado: cleaned.slice(0, 240),
      motivo: 'O A2 não retornou o JSON estruturado esperado.',
    }],
    avisos: [],
  });
}

export function mergeQAFindings(qa, findings = {}) {
  const merged = normalizeQa({
    ...qa,
    erros: [...arrayOrEmpty(qa?.erros), ...arrayOrEmpty(findings.errors)],
    avisos: [...arrayOrEmpty(qa?.avisos), ...arrayOrEmpty(findings.warnings)],
  });

  if (arrayOrEmpty(findings.errors).length) {
    merged.status = 'REPROVADO';
    merged.confianca = 'BAIXA';
    merged.resumo = `${merged.erros.length} problema(s) identificado(s) pela validação combinada.`;
  }

  return merged;
}

function lineFromItem(item) {
  const tipo = text(item?.tipo);
  const campo = text(item?.campo);
  const bruto = text(item?.bruto);
  const gerado = text(item?.gerado);
  const motivo = text(item?.motivo);
  const parts = [`${tipo || 'INFORMATIVO'} · ${campo || 'Ficha'}`];
  if (bruto) parts.push(`bruto: ${bruto}`);
  if (gerado) parts.push(`gerado: ${gerado}`);
  if (motivo) parts.push(motivo);
  return parts.join(' · ');
}

function addList(lines, title, items, emptyText = 'Nenhum.') {
  lines.push('', `${title}:`);
  if (!items.length) {
    lines.push(emptyText);
    return;
  }
  items.forEach(item => lines.push(`- ${lineFromItem(item)}`));
}

export function formatQAReport(qa) {
  const normalized = normalizeQa(qa);
  const lines = [
    `STATUS: ${normalized.status}`,
    `CONFIANÇA: ${normalized.confianca}`,
    '',
    'Resumo:',
    normalized.resumo,
  ];

  addList(lines, 'Erros', normalized.erros);
  addList(lines, 'Avisos', normalized.avisos);
  return lines.join('\n');
}
