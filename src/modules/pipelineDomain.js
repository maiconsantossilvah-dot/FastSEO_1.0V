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

const PRODUCT_TITLE_LABEL = /^(?:t[ií]tulo(?:\s+do\s+produto)?|descri[cç][aã]o(?:\s+do\s+produto)?|nome(?:\s+do\s+produto)?|produto)\s*[:-]\s*(.*)$/i;
const SOURCE_METADATA = /^(?:ean|c[oó]digo|cod\.?|sku|fornecedor|marca|modelo|refer[eê]ncia|dados\s+extra[ií]dos|aba|linha|p[aá]gina|m3)\s*:/i;

/**
 * Identifica o título comercial já presente na entrada. O valor continua sendo
 * parte do texto original; a extração apenas o destaca para evitar que o A1 ou
 * o A2 trate a primeira descrição do produto como cabeçalho descartável.
 */
export function extractProductTitle(input) {
  const lines = String(input || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(PRODUCT_TITLE_LABEL);
    if (!match) continue;
    const inlineValue = String(match[1] || '').trim();
    if (inlineValue) return inlineValue.slice(0, 500);

    const nextLine = lines.slice(index + 1).find(line => (
      !SOURCE_METADATA.test(line) && /[a-zA-ZÀ-ÿ]/.test(line)
    ));
    if (nextLine) return nextLine.slice(0, 500);
  }

  const unlabeled = lines.slice(0, 15).find(line => (
    line.length >= 5
    && line.length <= 500
    && /[a-zA-ZÀ-ÿ]/.test(line)
    && !SOURCE_METADATA.test(line)
    && !/^[-_=─\s]+$/.test(line)
    && !/^\d[\d\s./-]*$/.test(line)
    && !/^[A-ZÀ-Ý\s]{2,30}:$/.test(line)
  ));
  return unlabeled || '';
}

export function buildProductSource(input, heading = 'DADOS DO PRODUTO') {
  const raw = String(input || '').trim();
  const title = extractProductTitle(raw);
  const titleBlock = title
    ? `TÍTULO DO PRODUTO (PARTE DOS DADOS BRUTOS):\n${title}\n\n`
    : '';
  return `${heading}:\n${titleBlock}${raw}`;
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

  return `${buildProductSource(input, 'DADOS BRUTOS ORIGINAIS')}\n\n---\nFICHA GERADA:\n${ficha}${noticeValidation}${schemaBlock}`;
}
