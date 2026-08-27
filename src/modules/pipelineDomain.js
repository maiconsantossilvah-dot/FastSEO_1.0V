/**
 * Regras puras usadas pelo pipeline.
 *
 * Este módulo não acessa DOM, estado global, armazenamento ou rede. Ele concentra
 * a montagem dos prompts e pequenos ajustes determinísticos para que essas regras
 * possam ser testadas sem inicializar a interface do FastSEO.
 */

export function buildTitleRuleSnippet(rule) {
  if (!rule?.formula) return '';
  return `\n\n-- PADRÃO DE TÍTULO PARA "${rule.nome}" --\n`
    + `Estrutura do título: ${rule.formula}\n`
    + 'Siga exatamente essa estrutura ao gerar o TÍTULO SEO desta ficha.';
}

export function resolveTitleRule(matched = [], resolution = {}) {
  const compiledTitleRule = matched[0]?.titleRule;
  if (compiledTitleRule?.formula) {
    return {
      nome: matched[0].nome,
      formula: compiledTitleRule.formula,
      ex: compiledTitleRule.example || '',
    };
  }
  return resolution.titleRule;
}

export function insertNoticeBeforeSupplier(ficha, notice) {
  const text = String(ficha || '').trim();
  const noticeText = String(notice || '').trim();
  if (!noticeText || text.includes(noticeText)) return text;

  const supplier = text.match(/^Fornecedor\s*:/im);
  if (!supplier) return `${text}\n\n${noticeText}`;

  const before = text.slice(0, supplier.index).trimEnd();
  const after = text.slice(supplier.index).trimStart();
  return `${before}\n\n${noticeText}\n\n${after}`;
}

export function buildPipelinePrompts({ getPrompt, bivolt, fewShot = '', titleRule, seoContext = '' }) {
  const titleSnippet = buildTitleRuleSnippet(titleRule);
  const withSeo = base => seoContext ? `${base}\n\n${seoContext}` : base;

  return {
    agent1: withSeo(getPrompt(bivolt ? 'P1B' : 'P1') + fewShot + titleSnippet),
    // O A2 é auditor factual: contexto SEO não comprova dados e só aumenta o prompt.
    agent2: getPrompt(bivolt ? 'P2B' : 'P2'),
    agent3: withSeo(getPrompt(bivolt ? 'P3B' : 'P3') + fewShot + titleSnippet),
  };
}

export function buildQaInput({ input, ficha, noticeValidation = '', qaSchemaPrompt = '' }) {
  const schemaBlock = qaSchemaPrompt
    ? `\n\n---\nJSON DE VALIDAÇÃO DA CATEGORIA:\n${qaSchemaPrompt}`
    : '';

  return `DADOS BRUTOS ORIGINAIS:\n${input}\n\n---\nFICHA GERADA:\n${ficha}${noticeValidation}${schemaBlock}`;
}
