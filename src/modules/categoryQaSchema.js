const DEFAULT_FORBIDDEN_INVENTIONS = [
  'EAN',
  'código',
  'fornecedor',
  'marca',
  'modelo',
  'voltagem',
  'dimensões',
  'garantia',
  'compatibilidade',
  'material',
];

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function text(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function textToFieldList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item : item?.field || item?.nome || item?.name || '')
      .map(text)
      .filter(Boolean);
  }

  return String(value || '')
    .split(/\r?\n|;|,/)
    .map(text)
    .filter(Boolean);
}

export function fieldListToText(value) {
  return textToFieldList(value).join('\n');
}

export function createQaSchemaFromCategory(category = {}) {
  const nome = text(category.nome) || 'Sem nome';
  const requiredFields = textToFieldList(category.camposObrigatorios);
  const optionalFields = textToFieldList(category.camposOpcionais);
  const idealStructure = text(category.fichaIdeal);

  return {
    version: 1,
    category: nome,
    ideal_structure: idealStructure,
    required_fields: requiredFields.map(field => ({
      field,
      required: true,
      source: 'dados_brutos',
      on_missing_from_raw: 'warn',
      on_missing_from_ficha: 'reprove',
    })),
    optional_fields: optionalFields.map(field => ({
      field,
      required: false,
      source: 'dados_brutos',
      on_missing_from_raw: 'ignore',
      on_missing_from_ficha: 'warn_if_present_in_raw',
    })),
    format_rules: [
      {
        rule: 'Fornecedor deve ser copiado exatamente como aparece nos dados brutos.',
        severity: 'reprove',
      },
      {
        rule: 'A ficha não pode inventar especificações técnicas ausentes nos dados brutos.',
        severity: 'reprove',
      },
      {
        rule: 'Campos obrigatórios sem dado nos brutos podem aparecer como Não informado.',
        severity: 'warn',
      },
    ],
    forbidden_inventions: DEFAULT_FORBIDDEN_INVENTIONS,
    seo_rules: {
      must_not_invent: true,
      can_use_natural_keywords: true,
    },
  };
}

export function normalizeCategory(category = {}) {
  const camposObrigatorios = hasOwn(category, 'camposObrigatorios')
    ? textToFieldList(category.camposObrigatorios)
    : textToFieldList(category.campos);

  const avisoFichaTipo = text(category.avisoFichaTipo) || 'normal';

  const camposOpcionais = hasOwn(category, 'camposOpcionais')
    ? textToFieldList(category.camposOpcionais)
    : [];

  const fichaIdeal = hasOwn(category, 'fichaIdeal')
    ? text(category.fichaIdeal)
    : text(category.ficha);

  const normalized = {
    ...category,
    nome: text(category.nome) || 'Sem nome',
    camposObrigatorios,
    camposOpcionais,
    fichaIdeal,
    avisoFichaTipo,
  };

  normalized.qaSchema = category.qaSchema && typeof category.qaSchema === 'object'
    ? category.qaSchema
    : createQaSchemaFromCategory(normalized);

  return normalized;

}

export function buildCategoryPayload(input = {}, previous = {}) {
  const merged = normalizeCategory({ ...previous, ...input });
  merged.avisoFichaTipo = merged.avisoFichaTipo || 'normal';

  return {
    nome: merged.nome,
    status: merged.status || 'draft',
    profileType: merged.profileType || 'compact',
    parentId: merged.parentId || null,
    aliases: textToFieldList(merged.aliases),
    negativeTerms: textToFieldList(merged.negativeTerms),
    camposObrigatorios: textToFieldList(merged.camposObrigatorios),
    camposOpcionais: textToFieldList(merged.camposOpcionais),
    fichaIdeal: text(merged.fichaIdeal),
    avisoFichaTipo: merged.avisoFichaTipo || 'normal',
    titleRule: {
      formula: text(merged.titleRule?.formula),
      example: text(merged.titleRule?.example || merged.titleRule?.ex),
    },
    modifiers: Array.isArray(merged.modifiers) ? merged.modifiers : [],
    qaSchema: createQaSchemaFromCategory(merged),
    schemaVersion: Number(merged.schemaVersion) || 2,
    source: merged.source || 'manual',
  };
}

export function hasCategoryDefinition(category = {}) {
  const normalized = normalizeCategory(category);
  return Boolean(
    normalized.camposObrigatorios.length ||
    normalized.camposOpcionais.length ||
    normalized.fichaIdeal
  );
}

export function needsCategoryMigration(category = {}) {
  return !hasOwn(category, 'camposObrigatorios') ||
    !hasOwn(category, 'camposOpcionais') ||
    !hasOwn(category, 'fichaIdeal') ||
    !category.qaSchema;
}

export function buildCategoryQaSchemaPrompt(categories = []) {
  const schemas = categories
    .filter(Boolean)
    .map(normalizeCategory)
    .map(category => category.qaSchema || createQaSchemaFromCategory(category));

  if (!schemas.length) return '';

  return JSON.stringify({
    category_validation_schemas: schemas,
  }, null, 2);
}
