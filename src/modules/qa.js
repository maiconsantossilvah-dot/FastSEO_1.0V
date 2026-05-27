const QA_DEFAULT = {
  status: 'APROVADO',
  confianca: 'BAIXA',
  resumo: '',
  erros: [],
  avisos: [],
  campos_confirmados: [],
  campos_ausentes: [],
  campos_inferidos: [],
  seo: {
    status: 'INDEFINIDO',
    avisos: [],
    termos_validos: [],
    termos_suspeitos: [],
  },
  category_validation: {
    category: '',
    schema_version: '',
    checked_fields: [],
    failed_rules: [],
    warnings: [],
  },
};

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeStatus(value, fallback = 'APROVADO') {
  const status = text(value).toUpperCase();
  return status === 'REPROVADO' ? 'REPROVADO' : fallback;
}

function normalizeConfidence(value, status) {
  const confianca = text(value).toUpperCase();
  if (['ALTA', 'MEDIA', 'MÉDIA', 'BAIXA'].includes(confianca)) {
    return confianca === 'MÉDIA' ? 'MEDIA' : confianca;
  }
  return status === 'REPROVADO' ? 'BAIXA' : 'MEDIA';
}

function normalizeQa(value, raw = '') {
  const fallbackStatus = /STATUS\s*:\s*REPROVADO|REPROVADO/i.test(raw) ? 'REPROVADO' : 'APROVADO';
  const source = value && typeof value === 'object' ? value : {};
  const status = normalizeStatus(source.status, fallbackStatus);

  return {
    ...QA_DEFAULT,
    ...source,
    status,
    confianca: normalizeConfidence(source.confianca, status),
    resumo: text(source.resumo) || (status === 'REPROVADO' ? 'Ficha reprovada pelo A2.' : 'Ficha aprovada pelo A2.'),
    erros: arrayOrEmpty(source.erros),
    avisos: arrayOrEmpty(source.avisos),
    campos_confirmados: arrayOrEmpty(source.campos_confirmados),
    campos_ausentes: arrayOrEmpty(source.campos_ausentes),
    campos_inferidos: arrayOrEmpty(source.campos_inferidos),
    seo: {
      ...QA_DEFAULT.seo,
      ...(source.seo && typeof source.seo === 'object' ? source.seo : {}),
      avisos: arrayOrEmpty(source.seo?.avisos),
      termos_validos: arrayOrEmpty(source.seo?.termos_validos),
      termos_suspeitos: arrayOrEmpty(source.seo?.termos_suspeitos),
    },
    category_validation: {
      ...QA_DEFAULT.category_validation,
      ...(source.category_validation && typeof source.category_validation === 'object' ? source.category_validation : {}),
      category: text(source.category_validation?.category),
      schema_version: text(source.category_validation?.schema_version),
      checked_fields: arrayOrEmpty(source.category_validation?.checked_fields),
      failed_rules: arrayOrEmpty(source.category_validation?.failed_rules),
      warnings: arrayOrEmpty(source.category_validation?.warnings),
    },
  };
}

function stripFences(raw) {
  return text(raw).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export function parseQAJson(raw) {
  const cleaned = stripFences(raw);

  try {
    return normalizeQa(JSON.parse(cleaned), raw);
  } catch {}

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return normalizeQa(JSON.parse(cleaned.slice(first, last + 1)), raw);
    } catch {}
  }

  return normalizeQa({
    status: /STATUS\s*:\s*REPROVADO|REPROVADO/i.test(raw) ? 'REPROVADO' : 'APROVADO',
    confianca: 'BAIXA',
    resumo: 'A resposta do A2 nao veio em JSON valido.',
    avisos: ['JSON invalido retornado pelo A2. Foi usado fallback de compatibilidade.'],
  }, raw);
}

function lineFromItem(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return text(item);

  const campo = text(item.campo);
  const valor = text(item.valor);
  const motivo = text(item.motivo);
  const origem = text(item.origem);

  let line = campo ? campo : text(JSON.stringify(item));
  if (valor) line += `: ${valor}`;
  if (origem) line += ` (${origem})`;
  if (motivo) line += ` - ${motivo}`;
  return line;
}

function addList(lines, title, items, emptyText = 'Nenhum.') {
  lines.push('', `${title}:`);
  if (!items.length) {
    lines.push(emptyText);
    return;
  }
  items.forEach(item => {
    const line = lineFromItem(item);
    if (line) lines.push(`- ${line}`);
  });
}

export function formatQAReport(qa) {
  const normalized = normalizeQa(qa);
  const lines = [
    `STATUS: ${normalized.status}`,
    `CONFIANCA: ${normalized.confianca}`,
    '',
    'Resumo:',
    normalized.resumo,
  ];

  addList(lines, 'Erros', normalized.erros);
  addList(lines, 'Avisos', normalized.avisos);
  addList(lines, 'Campos Confirmados', normalized.campos_confirmados);
  addList(lines, 'Campos Ausentes', normalized.campos_ausentes);
  addList(lines, 'Campos Inferidos', normalized.campos_inferidos);

  lines.push('', 'SEO:');
  lines.push(`Status: ${text(normalized.seo.status) || 'INDEFINIDO'}`);
  addList(lines, 'Avisos SEO', normalized.seo.avisos);
  addList(lines, 'Termos Validos', normalized.seo.termos_validos);
  addList(lines, 'Termos Suspeitos', normalized.seo.termos_suspeitos);

  const categoryValidation = normalized.category_validation || {};
  const hasCategoryValidation = text(categoryValidation.category) ||
    arrayOrEmpty(categoryValidation.checked_fields).length ||
    arrayOrEmpty(categoryValidation.failed_rules).length ||
    arrayOrEmpty(categoryValidation.warnings).length;

  if (hasCategoryValidation) {
    lines.push('', 'Validacao da Categoria:');
    if (categoryValidation.category) lines.push(`Categoria: ${categoryValidation.category}`);
    if (categoryValidation.schema_version) lines.push(`Schema: ${categoryValidation.schema_version}`);
    addList(lines, 'Campos Checados', categoryValidation.checked_fields);
    addList(lines, 'Regras Reprovadas', categoryValidation.failed_rules);
    addList(lines, 'Avisos da Categoria', categoryValidation.warnings);
  }

  return lines.join('\n');
}
