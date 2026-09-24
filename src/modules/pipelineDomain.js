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

const PRODUCT_TITLE_LABEL = /^(?:t[ií]tulo(?:\s+do\s+produto)?|descri[cç][aã]o(?:\s+do\s+produto)?|nome(?:\s+do\s+produto)?|produto|tipo\s+do\s+produto)\s*[:-]\s*(.*)$/i;
const SOURCE_METADATA = /^(?:ean|gtin|ncm|c[oó]digo(?:\s+do\s+produto)?|cod\.?|sku|fornecedor|marca|fabricante|modelo|refer[eê]ncia|origem|dados\s+extra[ií]dos|aba|linha|p[aá]gina|m3)\b(?:\s*[:-]|\s+\S)/i;
const TECHNICAL_FIELD = /^(?:pot[eê]ncia|voltagem|tens[aã]o|frequ[eê]ncia|corrente|capacidade|peso|altura|largura|profundidade|comprimento|dimens[oõ]es?|material|cor|quantidade|garantia|compatibilidade|aplica[cç][aã]o|itens?\s+inclusos?|alimenta[cç][aã]o)\b(?:\s*[:-]|\s+\S)/i;
const SECTION_HEADING = /^(?:dados\s+(?:do\s+produto|brutos)|caracter[ií]sticas(?:\s+do\s+produto|\s+adicionais)?|especifica[cç][oõ]es(?:\s+t[eé]cnicas|\s+el[eé]tricas)?|dimens[oõ]es(?:\s+e\s+peso)?|benef[ií]cios|modo\s+de\s+uso|instala[cç][aã]o|precau[cç][oõ]es|conserva[cç][aã]o\s+e\s+cuidados)\s*:?$/i;

function isProductTitleCandidate(value) {
  const line = String(value || '').trim();
  if (line.length < 5 || line.length > 500 || !/[a-zA-ZÀ-ÿ]/.test(line)) return false;
  if (SOURCE_METADATA.test(line) || TECHNICAL_FIELD.test(line) || SECTION_HEADING.test(line)) return false;
  if (/^[^:\n]{1,60}\s*:\s*\S/.test(line)) return false;
  if (/^[-_=─\s]+$/.test(line) || /^\d[\d\s./-]*$/.test(line)) return false;
  if (/^[A-ZÀ-Ý\s]{2,40}:$/.test(line)) return false;
  return true;
}

const A1_INTERPRETATION_POLICY = `

-- POLÍTICA FIXA DE INTERPRETAÇÃO CONTROLADA --
- O TÍTULO ORIGINAL e os DADOS BRUTOS ORIGINAIS são fontes factuais com o mesmo valor.
- Interprete semanticamente o conteúdo: reconheça sinônimos, decomponha o título, reorganize tabelas/listas, agrupe atributos, elimine duplicações equivalentes e use nomes de campos mais claros.
- Você pode reescrever e estruturar; não pode criar fatos. Cada afirmação factual deve ser rastreável ao título ou aos dados brutos.
- Não amplie finalidade, compatibilidade, aplicação, desempenho, material, garantia ou benefício além do que a fonte sustenta.
- Categoria, regra de título, ficha ideal, exemplos e contexto SEO orientam somente a estrutura e nunca comprovam valores.`;

const A2_INTERPRETATION_POLICY = `

-- POLÍTICA FIXA DE AUDITORIA SEMÂNTICA --
- O TÍTULO ORIGINAL é parte dos dados brutos e pode, sozinho, comprovar um atributo da ficha.
- Aceite paráfrases fiéis, sinônimos, rótulos equivalentes, reorganização, consolidação de duplicatas e conversões exatas.
- Não reprove apenas porque a redação ou o nome do campo mudou; reprove quando o significado mudou, foi ampliado ou não possui fonte.
- Categoria, regra de título, ficha ideal, exemplos e contexto SEO nunca comprovam fatos.`;

/**
 * Identifica o título comercial já presente na entrada. O valor continua sendo
 * parte do texto original; a extração apenas o destaca para evitar que o A1 ou
 * o A2 trate a primeira descrição do produto como cabeçalho descartável.
 */
export function createProductSource(input) {
  const rawText = String(input || '').trim();
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n')
    .map((raw, index) => ({ raw: raw.trim(), index }))
    .filter(item => Boolean(item.raw));

  for (let position = 0; position < lines.length; position += 1) {
    const current = lines[position];
    const match = current.raw.match(PRODUCT_TITLE_LABEL);
    if (!match) continue;
    const inlineValue = String(match[1] || '').trim().slice(0, 500);
    if (inlineValue && isProductTitleCandidate(inlineValue)) {
      return {
        rawText, title: inlineValue, titleSource: 'explicit-label', titleConfidence: 'high', titleLine: current.index,
      };
    }

    const next = lines[position + 1];
    if (next && isProductTitleCandidate(next.raw)) {
      return {
        rawText, title: next.raw.slice(0, 500), titleSource: 'following-label', titleConfidence: 'high', titleLine: next.index,
      };
    }
  }

  const inferred = lines.slice(0, 20).find(item => isProductTitleCandidate(item.raw));
  if (inferred) {
    return {
      rawText, title: inferred.raw.slice(0, 500), titleSource: 'inferred-line', titleConfidence: 'medium', titleLine: inferred.index,
    };
  }

  return { rawText, title: '', titleSource: 'absent', titleConfidence: 'none', titleLine: null };
}

export function extractProductTitle(input) {
  return createProductSource(input).title;
}

function ensureProductSource(inputOrSource) {
  if (inputOrSource && typeof inputOrSource === 'object' && 'rawText' in inputOrSource) return inputOrSource;
  return createProductSource(inputOrSource);
}

export function buildProductSource(inputOrSource, heading = 'DADOS BRUTOS ORIGINAIS') {
  const source = ensureProductSource(inputOrSource);
  return `TÍTULO ORIGINAL DO PRODUTO — FONTE FACTUAL:\n${source.title || 'NÃO IDENTIFICADO'}\n\n`
    + `${heading} — FONTE FACTUAL:\n${source.rawText}`;
}

export function buildPipelinePrompts({ getPrompt, bivolt, fewShot = '', titleRule, seoContext = '' }) {
  const titleSnippet = buildTitleRuleSnippet(titleRule);
  const withSeo = base => seoContext ? `${base}\n\n${seoContext}` : base;

  return {
    agent1: withSeo(getPrompt(bivolt ? 'P1B' : 'P1') + fewShot + titleSnippet) + A1_INTERPRETATION_POLICY,
    // O A2 é auditor factual: contexto SEO não comprova dados e só aumenta o prompt.
    agent2: getPrompt(bivolt ? 'P2B' : 'P2') + A2_INTERPRETATION_POLICY,
    agent3: withSeo(getPrompt(bivolt ? 'P3B' : 'P3') + fewShot + titleSnippet),
  };
}

export function buildQaInput({ input, productSource, ficha, noticeValidation = '', qaSchemaPrompt = '' }) {
  const schemaBlock = qaSchemaPrompt
    ? `\n\n---\nJSON DE VALIDAÇÃO DA CATEGORIA:\n${qaSchemaPrompt}`
    : '';

  return `${buildProductSource(productSource || input)}\n\n---\nFICHA GERADA:\n${ficha}${noticeValidation}${schemaBlock}`;
}
