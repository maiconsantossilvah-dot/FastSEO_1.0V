/**
 * Shared product matching helpers.
 * Keeps category and subcategory matching on the same scoring rules.
 */

const STOP_WORDS = new Set(['o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','para','com','por','em','no','na','nos','nas','e']);

const CONTEXT_CONNECTORS = [
  'compativel com',
  'compatibilidade com',
  'para uso em',
  'uso em',
  'aplicacao em',
  'aplicacao para',
  'acessorio para',
  'peca para',
  'refil para',
  'kit para',
  'para',
];

const SCORE_RULES = [
  ['exactPrimary', 92],
  ['allPrimary', 70],
  ['strongPrimary', 46],
  ['exactTitle', 44],
  ['allTitle', 58],
  ['strongTitle', 26],
  ['exactGeneral', 28],
  ['allGeneral', 18],
  ['strongGeneral', 10],
];

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s) {
  return normalizeText(s).split(' ').filter(t => t && !STOP_WORDS.has(t));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhrase(text, phrase) {
  return new RegExp(`(?:^|\\s)${escapeRe(phrase)}(?:\\s|$)`).test(text);
}

function hasAllTokens(tokens, wanted) {
  return wanted.every(t => tokens.includes(t));
}

function splitPrincipalContexto(text) {
  const normalized = normalizeText(text);
  const pattern = new RegExp(`\\b(${CONTEXT_CONNECTORS.map(escapeRe).join('|')})\\b`);
  const match = normalized.match(pattern);
  return !match || match.index < 3
    ? { principal: normalized, contexto: '' }
    : {
        principal: normalized.slice(0, match.index).trim(),
        contexto: normalized.slice(match.index + match[0].length).trim(),
      };
}

function isNoiseLine(line) {
  const semEspaco = line.replace(/\s/g, '');
  const digitRatio = semEspaco ? (semEspaco.match(/\d/g) || []).length / semEspaco.length : 0;
  return !semEspaco.length ||
    /^[=\-_*]{4,}$/.test(semEspaco) ||
    digitRatio > 0.5 ||
    /\b(ean|ncm|gtin|sku)\b/i.test(line) ||
    /^\s*(fornecedor|marca|ref|cod|codigo|cod\.|fabricante|modelo|origem)\s*:/i.test(normalizeText(line));
}

function cleanTitleLine(line) {
  return String(line || '').replace(/^\s*(descricao|descri[cç][aã]o|produto|nome do produto)\s*:\s*/i, '').trim();
}

function getInputParts(input) {
  const linhas = String(input || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10);
  const linhasUteis = linhas
    .filter(l => !isNoiseLine(l) && l.replace(/\d/g, '').trim().length >= 4)
    .map(cleanTitleLine);
  const tituloRaw = linhasUteis.slice(0, 3).join(' ') || linhas[0] || '';
  const titulo = normalizeText(tituloRaw);
  const geral = normalizeText(input).slice(0, 1200);
  const { principal, contexto } = splitPrincipalContexto(tituloRaw);

  return {
    titulo,
    geral,
    principal,
    contexto,
    tokensTitulo: tokenize(titulo),
    tokensGeral: tokenize(geral),
    tokensPrincipal: tokenize(principal),
    tokensContexto: tokenize(contexto),
  };
}

function buildCandidateFacts(parts, name, options) {
  const key = normalizeText(name);
  const tokens = tokenize(name);
  if (!key || !tokens.length) return null;

  const countHits = source => tokens.filter(t => source.includes(t)).length;
  const primaryHits = countHits(parts.tokensPrincipal);
  const titleHits = countHits(parts.tokensTitulo);
  const contextHits = countHits(parts.tokensContexto);
  const geralHits = countHits(parts.tokensGeral);

  const primaryRatio = primaryHits / tokens.length;
  const titleRatio = titleHits / tokens.length;
  const contextRatio = contextHits / tokens.length;
  const geralRatio = geralHits / tokens.length;
  const exactPrimary = hasPhrase(parts.principal, key);
  const exactContext = hasPhrase(parts.contexto, key);
  const contextOnly = !!parts.contexto &&
    (exactContext || contextHits === tokens.length || (tokens.length > 1 && contextRatio >= 0.75)) &&
    !exactPrimary &&
    primaryRatio < 0.75;

  return {
    key,
    tokens,
    contextOnly,
    primaryScore: exactPrimary || primaryRatio >= 0.75,
    exactPrimary,
    allPrimary: hasAllTokens(parts.tokensPrincipal, tokens),
    strongPrimary: tokens.length > 1 && primaryRatio >= 0.75,
    exactTitle: hasPhrase(parts.titulo, key) && !contextOnly,
    allTitle: hasAllTokens(parts.tokensTitulo, tokens),
    strongTitle: tokens.length > 1 && titleRatio >= 0.75 && !contextOnly,
    exactGeneral: options.allowGeneralFallback && hasPhrase(parts.geral, key) && !contextOnly,
    allGeneral: options.allowGeneralFallback && hasAllTokens(parts.tokensGeral, tokens) && !contextOnly,
    strongGeneral: options.allowGeneralFallback && tokens.length > 1 && geralRatio >= 0.75 && !contextOnly,
    contextScore: (exactContext ? 18 : 10) + Math.min(tokens.length, 6) * 2,
    singleTokenOutsidePrimary: tokens.length === 1 && !exactPrimary && !parts.tokensPrincipal.includes(tokens[0]),
  };
}

function scoreCandidate(facts) {
  const baseScore = facts.contextOnly
    ? facts.contextScore
    : SCORE_RULES.reduce((total, [flag, points]) => total + (facts[flag] ? points : 0), 0);

  const score = baseScore + Math.min(facts.tokens.length, 6) * 4;
  return facts.singleTokenOutsidePrimary
    ? (facts.contextOnly ? Math.min(score, 12) : 0)
    : score;
}

function removeContextOnlyWhenPrimaryExists(scored) {
  const hasPrimaryMatch = scored.some(item => !item.contextOnly && item.primaryScore >= 34);
  return hasPrimaryMatch ? scored.filter(item => !item.contextOnly) : scored;
}

function removeGenericMatches(candidates) {
  return candidates.filter(item => !candidates.some(other =>
    other !== item &&
    other.score >= item.score - 35 &&
    other.tokens.length > item.tokens.length &&
    item.tokens.every(t => other.tokens.includes(t))
  ));
}

export function rankMatches(input, items, getName = item => item.nome, options = {}) {
  const config = { allowGeneralFallback: true, scope: 'full', ...options };
  if (config.scope === 'title') config.allowGeneralFallback = false;
  const parts = getInputParts(input);
  const scored = items
    .map(item => {
      const facts = buildCandidateFacts(parts, getName(item), config);
      if (!facts) return null;
      const score = scoreCandidate(facts);
      return score >= 34 ? { item, score, ...facts, primaryScore: facts.primaryScore ? score : 0 } : null;
    })
    .filter(Boolean);

  return removeGenericMatches(removeContextOnlyWhenPrimaryExists(scored))
    .sort((a, b) => b.score - a.score || b.tokens.length - a.tokens.length);
}

export function bestMatch(input, items, getName = item => item.nome, options = {}) {
  return rankMatches(input, items, getName, options)[0]?.item || null;
}
