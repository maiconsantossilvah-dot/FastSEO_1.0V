import type {
  CategoryMatchDiagnostics,
  CategoryModifier,
  CategoryProfile,
  CategoryResolution,
  ProductSource,
} from './types.js';

const PRODUCT_TITLE_LABEL = /^(?:t[ií]tulo(?:\s+do\s+produto)?|descri[cç][aã]o(?:\s+do\s+produto)?|nome(?:\s+do\s+produto)?|produto|tipo\s+do\s+produto)\s*[:-]\s*(.*)$/i;
const SOURCE_METADATA = /^(?:ean|gtin|ncm|c[oó]digo(?:\s+do\s+produto)?|cod\.?|sku|fornecedor|marca|fabricante|modelo|refer[eê]ncia|origem|dados\s+extra[ií]dos|aba|linha|p[aá]gina|m3)\b(?:\s*[:-]|\s+\S)/i;
const TECHNICAL_FIELD = /^(?:pot[eê]ncia|voltagem|tens[aã]o|frequ[eê]ncia|corrente|capacidade|peso|altura|largura|profundidade|comprimento|dimens[oõ]es?|material|cor|quantidade|garantia|compatibilidade|aplica[cç][aã]o|itens?\s+inclusos?|alimenta[cç][aã]o)\b(?:\s*[:-]|\s+\S)/i;
const SECTION_HEADING = /^(?:dados\s+(?:do\s+produto|brutos)|caracter[ií]sticas(?:\s+do\s+produto|\s+adicionais)?|especifica[cç][oõ]es(?:\s+t[eé]cnicas|\s+el[eé]tricas)?|dimens[oõ]es(?:\s+e\s+peso)?|benef[ií]cios|modo\s+de\s+uso|instala[cç][aã]o|precau[cç][oõ]es|conserva[cç][aã]o\s+e\s+cuidados)\s*:?$/i;
const CONTEXT_CONNECTORS = [
  'compatível com', 'compativel com', 'compatibilidade com', 'para uso em', 'uso em',
  'aplicação em', 'aplicacao em', 'indicado para', 'acessório para', 'acessorio para',
  'peça para', 'peca para', 'refil para', 'suporte para', 'capa para', 'kit para', 'para',
];
const ATTRIBUTE_PRECEDERS = new Set([
  'com', 'inclui', 'incluso', 'inclusa', 'acompanha', 'contendo', 'alimentacao', 'compativel',
]);
const SINGLE_TOKEN_LEADERS = new Set(['o', 'a', 'um', 'uma', 'smart', 'mini', 'micro', 'super', 'ultra']);
const MIN_SCORE = 100;
const MIN_MARGIN = 8;
export const CATEGORY_MATCHER_VERSION = 'title-identity-v2';

type ScoredProfile = {
  profile: CategoryProfile;
  score: number;
  evidence: string;
  evidenceKind: 'name' | 'alias';
  evidenceTokens: string[];
  aliasIndex: number;
};

export function normalizeMatchText(value: unknown): string {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalToken(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith('oes') || token.endsWith('aes')) return `${token.slice(0, -3)}ao`;
  if (token.endsWith('ais')) return `${token.slice(0, -3)}al`;
  if (token.endsWith('eis')) return `${token.slice(0, -3)}el`;
  if (token.endsWith('ns')) return `${token.slice(0, -2)}m`;
  if (token.endsWith('s') && !token.endsWith('ss') && !token.endsWith('is') && !token.endsWith('us')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokens(value: string): string[] {
  return normalizeMatchText(value).split(' ').filter(Boolean).map(canonicalToken);
}

function phraseIndex(sourceTokens: string[], candidateTokens: string[]): number {
  if (!candidateTokens.length || candidateTokens.length > sourceTokens.length) return -1;
  for (let index = 0; index <= sourceTokens.length - candidateTokens.length; index += 1) {
    if (candidateTokens.every((token, offset) => sourceTokens[index + offset] === token)) return index;
  }
  return -1;
}

function containsPhrase(source: string, candidate: string): boolean {
  return phraseIndex(tokens(source), tokens(candidate)) >= 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function isProductTitleCandidate(value: string): boolean {
  const line = String(value || '').trim();
  if (line.length < 5 || line.length > 500 || !/[a-zA-ZÀ-ÿ]/.test(line)) return false;
  if (SOURCE_METADATA.test(line) || TECHNICAL_FIELD.test(line) || SECTION_HEADING.test(line)) return false;
  if (/^[^:\n]{1,60}\s*:\s*\S/.test(line)) return false;
  if (/^[-_=─\s]+$/.test(line) || /^\d[\d\s./-]*$/.test(line)) return false;
  if (/^[A-ZÀ-Ý\s]{2,40}:$/.test(line)) return false;
  return true;
}

/**
 * Extrai uma única representação do produto para matching e para os agentes.
 * O título nunca é reescrito: ele é apenas referenciado a partir do input original.
 */
export function createProductSource(input: string): ProductSource {
  const rawText = String(input || '').trim();
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n')
    .map((raw, index) => ({ raw: raw.trim(), index }))
    .filter(item => Boolean(item.raw));

  for (let position = 0; position < lines.length; position += 1) {
    const current = lines[position];
    if (!current) continue;
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

function contextBoundary(titleTokens: string[]): { connectorIndex: number; contextStart: number } | null {
  let best: { connectorIndex: number; contextStart: number } | null = null;
  for (const connector of CONTEXT_CONNECTORS) {
    const connectorTokens = tokens(connector);
    const index = phraseIndex(titleTokens, connectorTokens);
    if (index <= 0) continue;
    if (!best || index < best.connectorIndex) {
      best = { connectorIndex: index, contextStart: index + connectorTokens.length };
    }
  }
  return best;
}

function aliasEvidence(source: ProductSource, alias: string) {
  if (!source.title || source.titleConfidence === 'none') return null;
  const titleTokens = tokens(source.title);
  const aliasTokens = tokens(alias);
  const aliasIndex = phraseIndex(titleTokens, aliasTokens);
  if (aliasIndex < 0 || !aliasTokens.length) return null;

  const boundary = contextBoundary(titleTokens);
  const contextOnly = Boolean(boundary && aliasIndex >= boundary.contextStart);
  const spansConnector = Boolean(
    boundary
    && aliasIndex < boundary.connectorIndex
    && aliasIndex + aliasTokens.length > boundary.contextStart,
  );
  const previous = titleTokens[aliasIndex - 1] || '';
  const precededByAttribute = ATTRIBUTE_PRECEDERS.has(previous);
  const positionAllowed = aliasIndex === 0 || (
    aliasIndex === 1
    && SINGLE_TOKEN_LEADERS.has(titleTokens[0] || '')
  );

  if (contextOnly && !spansConnector) return { kind: 'context' as const };
  if (!positionAllowed || precededByAttribute) return { kind: 'weak' as const };

  const confidenceBase = source.titleConfidence === 'high' ? 120 : 110;
  const specificity = Math.min(aliasTokens.length, 5) * 12;
  const exactTitleBonus = aliasTokens.length === titleTokens.length ? 8 : 0;
  return {
    kind: 'identity' as const,
    score: confidenceBase + specificity + exactTitleBonus - aliasIndex * 10,
    aliasTokens,
    aliasIndex,
  };
}

function scoreProfile(source: ProductSource, profile: CategoryProfile) {
  const aliases = unique([profile.name, ...profile.aliases]);
  const blocked = profile.negativeTerms.some(term => containsPhrase(source.rawText, term));
  if (blocked) return { candidate: null, blocked: true, contextOnly: false, weak: false };

  let best: ScoredProfile | null = null;
  let contextOnly = false;
  let weak = false;
  for (const alias of aliases) {
    const evidence = aliasEvidence(source, alias);
    if (!evidence) continue;
    if (evidence.kind === 'context') {
      contextOnly = true;
      continue;
    }
    if (evidence.kind === 'weak') {
      weak = true;
      continue;
    }
    if (!best || evidence.score > best.score) {
      best = {
        profile,
        score: evidence.score,
        evidence: alias,
        evidenceKind: normalizeMatchText(alias) === normalizeMatchText(profile.name) ? 'name' : 'alias',
        evidenceTokens: evidence.aliasTokens,
        aliasIndex: evidence.aliasIndex,
      };
    }
  }
  return { candidate: best, blocked: false, contextOnly, weak };
}

function modifierMatches(input: string, modifier: CategoryModifier): boolean {
  if (modifier.negativeTerms.some(term => containsPhrase(input, term))) return false;
  return unique([modifier.name, ...modifier.aliases]).some(alias => containsPhrase(input, alias));
}

function mergeProfile(profile: CategoryProfile, parents: CategoryProfile[], modifiers: CategoryModifier[]): CategoryProfile {
  const chain = [...parents, profile];
  return {
    ...profile,
    aliases: unique(chain.flatMap(item => item.aliases)),
    negativeTerms: unique(chain.flatMap(item => item.negativeTerms)),
    requiredFields: unique([
      ...chain.flatMap(item => item.requiredFields),
      ...modifiers.flatMap(item => item.addRequiredFields),
    ]),
    optionalFields: unique([
      ...chain.flatMap(item => item.optionalFields),
      ...modifiers.flatMap(item => item.addOptionalFields),
    ]),
    idealSheet: profile.idealSheet || [...parents].reverse().find(item => item.idealSheet)?.idealSheet || '',
    titleRule: {
      formula: profile.titleRule.formula || [...parents].reverse().find(item => item.titleRule.formula)?.titleRule.formula || '',
      example: profile.titleRule.example || [...parents].reverse().find(item => item.titleRule.example)?.titleRule.example || '',
    },
  };
}

function parentChain(profile: CategoryProfile, profiles: CategoryProfile[]): CategoryProfile[] {
  const byId = new Map(profiles.map(item => [item.id, item]));
  const parents: CategoryProfile[] = [];
  const visited = new Set([profile.id]);
  let parentId = profile.parentId;
  while (parentId && !visited.has(parentId) && parents.length < 10) {
    const parent = byId.get(parentId);
    if (!parent) break;
    parents.unshift(parent);
    visited.add(parent.id);
    parentId = parent.parentId;
  }
  return parents;
}

function diagnostics(
  reason: CategoryMatchDiagnostics['reason'],
  score = 0,
  runnerUpScore = 0,
  confidence = 0,
  candidate?: ScoredProfile,
): CategoryMatchDiagnostics {
  return {
    reason,
    score,
    runnerUpScore,
    confidence: Number(confidence.toFixed(2)),
    evidenceZone: score > 0 ? 'title' : 'none',
    evidence: candidate ? [candidate.evidence] : [],
    evidenceKind: candidate?.evidenceKind || 'none',
    candidate: candidate ? { id: candidate.profile.id, name: candidate.profile.name } : null,
    matcherVersion: CATEGORY_MATCHER_VERSION,
  };
}

export function resolveCategoryDetailed(
  input: string,
  profiles: CategoryProfile[],
  catalogVersion = 0,
  providedSource?: ProductSource,
): { resolution: CategoryResolution | null; diagnostics: CategoryMatchDiagnostics; productSource: ProductSource } {
  const productSource = providedSource || createProductSource(input);
  if (!productSource.title) {
    return { resolution: null, diagnostics: diagnostics('NO_IDENTITY_EVIDENCE'), productSource };
  }

  const evaluated = profiles.map(profile => scoreProfile(productSource, profile));
  const ranked = evaluated.map(item => item.candidate).filter((item): item is ScoredProfile => Boolean(item))
    .sort((a, b) => b.score - a.score || b.evidenceTokens.length - a.evidenceTokens.length || a.aliasIndex - b.aliasIndex);
  const best = ranked[0];

  if (!best) {
    const reason = evaluated.some(item => item.contextOnly)
      ? 'CONTEXT_ONLY'
      : evaluated.some(item => item.blocked)
        ? 'NEGATIVE_TERM'
        : evaluated.some(item => item.weak)
          ? 'BELOW_THRESHOLD'
          : 'NO_IDENTITY_EVIDENCE';
    return { resolution: null, diagnostics: diagnostics(reason), productSource };
  }

  const runnerUp = ranked[1];
  const runnerUpScore = runnerUp?.score || 0;
  if (best.score < MIN_SCORE) {
    return {
      resolution: null,
      diagnostics: diagnostics('BELOW_THRESHOLD', best.score, runnerUpScore, 0, best),
      productSource,
    };
  }
  if (runnerUp && best.score - runnerUp.score < MIN_MARGIN) {
    return {
      resolution: null,
      diagnostics: diagnostics('AMBIGUOUS_MATCH', best.score, runnerUp.score, 0, best),
      productSource,
    };
  }

  const parents = parentChain(best.profile, profiles);
  const availableModifiers = [...parents.flatMap(parent => parent.modifiers), ...best.profile.modifiers];
  const modifierById = new Map(availableModifiers.map(modifier => [modifier.id, modifier]));
  const matchedModifiers = [...modifierById.values()].filter(modifier => modifierMatches(input, modifier));
  const compiledProfile = mergeProfile(best.profile, parents, matchedModifiers);
  const distance = Math.max(0, best.score - runnerUpScore);
  const confidence = Math.min(0.99, 0.68 + Math.min(best.score - MIN_SCORE, 40) / 100 + Math.min(distance, 30) / 150);
  const resolution: CategoryResolution = {
    family: { id: best.profile.id, name: best.profile.name },
    modifiers: matchedModifiers.map(modifier => ({ id: modifier.id, name: modifier.name })),
    confidence: Number(confidence.toFixed(2)),
    score: best.score,
    evidence: unique([best.evidence, ...matchedModifiers.map(modifier => modifier.name)]),
    compiledProfile,
    catalogVersion,
  };

  return {
    resolution,
    diagnostics: diagnostics('MATCHED', best.score, runnerUpScore, confidence, best),
    productSource,
  };
}

export function resolveCategory(
  input: string,
  profiles: CategoryProfile[],
  catalogVersion = 0,
  productSource?: ProductSource,
): CategoryResolution | null {
  return resolveCategoryDetailed(input, profiles, catalogVersion, productSource).resolution;
}
