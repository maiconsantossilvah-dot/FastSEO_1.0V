import type { CategoryModifier, CategoryProfile, CategoryResolution } from './types.js';

const STOP_WORDS = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'para', 'com', 'por', 'em', 'no', 'na', 'e']);
const CONTEXT_CONNECTORS = ['acessorio para', 'peça para', 'peca para', 'refil para', 'suporte para', 'kit para', 'para'];

export function normalizeMatchText(value: unknown): string {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singular(token: string): string {
  if (token.length <= 4) return token;
  if (token.endsWith('oes')) return `${token.slice(0, -3)}ao`;
  if (token.endsWith('ais')) return `${token.slice(0, -3)}al`;
  if (token.endsWith('is')) return token.slice(0, -2) + 'il';
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokens(value: string): string[] {
  return normalizeMatchText(value).split(' ').filter(token => token && !STOP_WORDS.has(token)).map(singular);
}

function splitPrincipal(value: string): { principal: string; context: string } {
  const normalized = normalizeMatchText(value);
  let bestIndex = -1;
  let connector = '';
  for (const candidate of CONTEXT_CONNECTORS) {
    const normalizedCandidate = normalizeMatchText(candidate);
    const match = new RegExp(`\\b${normalizedCandidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).exec(normalized);
    const index = match?.index ?? -1;
    if (index > 1 && (bestIndex < 0 || index < bestIndex)) {
      bestIndex = index;
      connector = candidate;
    }
  }
  if (bestIndex < 0) return { principal: normalized, context: '' };
  return {
    principal: normalized.slice(0, bestIndex).trim(),
    context: normalized.slice(bestIndex + normalizeMatchText(connector).length).trim(),
  };
}

function phraseMatch(source: string, candidate: string): boolean {
  const sourceTokens = tokens(source);
  const candidateTokens = tokens(candidate);
  if (!candidateTokens.length) return false;
  return candidateTokens.every(token => sourceTokens.includes(token));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function scoreProfile(input: string, profile: CategoryProfile) {
  const firstLines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 3).join(' ');
  const { principal, context } = splitPrincipal(firstLines || input);
  const aliases = unique([profile.name, ...profile.aliases]);
  const blocked = profile.negativeTerms.some(term => phraseMatch(input, term));
  if (blocked) return null;

  let best = 0;
  let evidence = '';
  for (const alias of aliases) {
    const aliasTokens = tokens(alias);
    if (!aliasTokens.length) continue;
    let score = 0;
    if (phraseMatch(principal, alias)) score += 80 + Math.min(aliasTokens.length, 5) * 5;
    else if (phraseMatch(firstLines, alias)) score += 58 + Math.min(aliasTokens.length, 5) * 4;
    else if (phraseMatch(input, alias)) score += 38 + Math.min(aliasTokens.length, 5) * 3;
    if (context && phraseMatch(context, alias) && !phraseMatch(principal, alias)) score = Math.min(score, 24);
    if (score > best) {
      best = score;
      evidence = alias;
    }
  }

  return best >= 35 ? { profile, score: best, evidence } : null;
}

function modifierMatches(input: string, modifier: CategoryModifier): boolean {
  if (modifier.negativeTerms.some(term => phraseMatch(input, term))) return false;
  return unique([modifier.name, ...modifier.aliases]).some(alias => phraseMatch(input, alias));
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

export function resolveCategory(input: string, profiles: CategoryProfile[], catalogVersion = 0): CategoryResolution | null {
  const ranked = profiles.map(profile => scoreProfile(input, profile)).filter(Boolean)
    .sort((a, b) => b!.score - a!.score || b!.profile.name.length - a!.profile.name.length);
  const best = ranked[0];
  if (!best) return null;

  const parents = parentChain(best.profile, profiles);
  const availableModifiers = [...parents.flatMap(parent => parent.modifiers), ...best.profile.modifiers];
  const modifierById = new Map(availableModifiers.map(modifier => [modifier.id, modifier]));
  const matchedModifiers = [...modifierById.values()].filter(modifier => modifierMatches(input, modifier));
  const compiledProfile = mergeProfile(best.profile, parents, matchedModifiers);
  const runnerUp = ranked[1]?.score || 0;
  const distance = Math.max(0, best.score - runnerUp);
  const confidence = Math.min(0.99, Math.max(0.35, (best.score / 120) * 0.75 + Math.min(distance, 40) / 160));

  return {
    family: { id: best.profile.id, name: best.profile.name },
    modifiers: matchedModifiers.map(modifier => ({ id: modifier.id, name: modifier.name })),
    confidence: Number(confidence.toFixed(2)),
    score: best.score,
    evidence: unique([best.evidence, ...matchedModifiers.map(modifier => modifier.name)]),
    compiledProfile,
    catalogVersion,
  };
}
