import { createQaSchemaFromCategory, textToFieldList } from '../../modules/categoryQaSchema.js';

const byId = (root, id) => root.getElementById(id);

export function readEditorDraft(root = document) {
  return {
    nome: byId(root, 'catEditNome')?.value.trim() || 'Sem nome',
    profileType: byId(root, 'catEditProfileType')?.value || 'compact',
    parentId: byId(root, 'catEditParent')?.value || null,
    aliases: textToFieldList(byId(root, 'catEditAliases')?.value || ''),
    negativeTerms: textToFieldList(byId(root, 'catEditNegativeTerms')?.value || ''),
    camposObrigatorios: textToFieldList(byId(root, 'catEditObrigatorios')?.value || ''),
    camposOpcionais: textToFieldList(byId(root, 'catEditOpcionais')?.value || ''),
    fichaIdeal: byId(root, 'catEditFichaIdeal')?.value || '',
    avisoFichaTipo: byId(root, 'catEditAvisoFicha')?.value || 'normal',
    titleRule: {
      formula: byId(root, 'catEditTitleFormula')?.value || '',
      example: byId(root, 'catEditTitleExample')?.value || '',
    },
    modifiers: [...root.querySelectorAll('#catEditModifiers .cat-modifier-row')].map((row, index) => ({
      id: row.dataset.id || `modificador-${index + 1}`,
      nome: row.querySelector('[data-mod-name]')?.value.trim() || `Modificador ${index + 1}`,
      aliases: textToFieldList(row.querySelector('[data-mod-aliases]')?.value || ''),
      negativeTerms: [],
      camposObrigatorios: [],
      camposOpcionais: textToFieldList(row.querySelector('[data-mod-fields]')?.value || ''),
      titleSuffix: '',
    })),
  };
}

export function updateQaPreview(root = document) {
  const preview = byId(root, 'catEditQaPreview');
  if (!preview) return;
  preview.textContent = JSON.stringify(createQaSchemaFromCategory(readEditorDraft(root)), null, 2);
}

export function readAiExamples(root = document) {
  return [...root.querySelectorAll('#catsAiExamples .cat-ai-example')]
    .map(textarea => textarea.value.trim());
}

export function countReadyExamples(examples) {
  return examples.filter(example => example.length >= 40).length;
}

function limitedStringArray(value, max) {
  return Array.isArray(value)
    ? value.map(String).map(item => item.trim()).filter(Boolean).slice(0, max)
    : [];
}

/** Valida e limita a resposta externa antes de deixá-la chegar ao formulário. */
export function normalizeAiSuggestion(raw) {
  if (!['compact', 'technical', 'generic'].includes(raw?.profileType)) {
    throw new Error('A IA retornou um tipo de perfil inválido.');
  }
  return {
    profileType: raw.profileType,
    summary: String(raw.summary || '').slice(0, 600),
    aliases: limitedStringArray(raw.aliases, 12),
    negativeTerms: limitedStringArray(raw.negativeTerms, 8),
    requiredFields: limitedStringArray(raw.requiredFields, 12),
    optionalFields: limitedStringArray(raw.optionalFields, 24),
    idealSheet: String(raw.idealSheet || '').slice(0, 6000),
    titleRule: {
      formula: String(raw.titleRule?.formula || '').slice(0, 1000),
      example: String(raw.titleRule?.example || '').slice(0, 1000),
    },
    modifiers: (Array.isArray(raw.modifiers) ? raw.modifiers : []).slice(0, 6).map((item, index) => ({
      id: String(item?.id || `modificador-ia-${index + 1}`),
      name: String(item?.name || '').trim(),
      aliases: limitedStringArray(item?.aliases, 12),
      negativeTerms: limitedStringArray(item?.negativeTerms, 8),
      addRequiredFields: limitedStringArray(item?.addRequiredFields, 12),
      addOptionalFields: limitedStringArray(item?.addOptionalFields, 20),
      titleSuffix: String(item?.titleSuffix || '').slice(0, 500),
    })).filter(item => item.name),
  };
}

export function buildAiAnalysisPayload(draft, examples) {
  return {
    category: draft.nome,
    currentProfileType: draft.profileType,
    currentAliases: draft.aliases.slice(0, 20),
    currentRequiredFields: draft.camposObrigatorios.slice(0, 30),
    currentOptionalFields: draft.camposOpcionais.slice(0, 40),
    currentTitleRule: draft.titleRule,
    exampleSheets: examples.map((example, index) => ({ number: index + 1, content: example.slice(0, 3500) })),
    instruction: 'Encontre o melhor padrão comum entre as cinco fichas e sugira uma configuração objetiva e reutilizável para a categoria.',
  };
}

const unique = values => [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];

export function applyAiSuggestion(root, suggestion) {
  const setValue = (id, value) => { const field = byId(root, id); if (field) field.value = value; };
  const setList = (id, values) => setValue(id, unique(values).join('\n'));
  setValue('catEditProfileType', suggestion.profileType);
  setList('catEditAliases', suggestion.aliases || []);
  setList('catEditNegativeTerms', suggestion.negativeTerms || []);
  setList('catEditObrigatorios', suggestion.requiredFields || []);
  setList('catEditOpcionais', suggestion.optionalFields || []);
  setValue('catEditTitleFormula', suggestion.titleRule?.formula || '');
  setValue('catEditTitleExample', suggestion.titleRule?.example || '');
  setValue('catEditFichaIdeal', suggestion.idealSheet || '');

  return (suggestion.modifiers || []).map((item, index) => ({
    id: item.id || `modificador-ia-${index + 1}`,
    nome: item.name,
    aliases: item.aliases || [],
    negativeTerms: item.negativeTerms || [],
    camposObrigatorios: item.addRequiredFields || [],
    camposOpcionais: item.addOptionalFields || [],
    titleSuffix: item.titleSuffix || '',
  }));
}
