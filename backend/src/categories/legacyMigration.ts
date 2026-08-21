import { normalizeMatchText } from './categoryResolver.js';
import type { CategoryProfile } from './types.js';

interface LegacyCategory {
  id?: string;
  nome?: string;
  campos?: unknown;
  camposObrigatorios?: unknown;
  camposOpcionais?: unknown;
  ficha?: unknown;
  fichaIdeal?: unknown;
  avisoFichaTipo?: unknown;
  qaSchema?: unknown;
}

interface LegacySubcategory {
  nome?: string;
  formula?: string;
  ex?: string;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value || '').split(/\r?\n|;|,/).map(item => item.trim()).filter(Boolean);
}

export function slugifyCategory(value: string): string {
  return normalizeMatchText(value).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 100) || 'categoria';
}

function findParent(profile: CategoryProfile, profiles: CategoryProfile[]): string | null {
  const ownTokens = new Set(normalizeMatchText(profile.name).split(' ').filter(Boolean));
  return profiles
    .filter(candidate => candidate.id !== profile.id)
    .map(candidate => ({
      candidate,
      tokens: normalizeMatchText(candidate.name).split(' ').filter(Boolean),
    }))
    .filter(item => item.tokens.length < ownTokens.size && item.tokens.every(token => ownTokens.has(token)))
    .sort((a, b) => b.tokens.length - a.tokens.length)[0]?.candidate.id || null;
}

export function convertLegacyCatalog(categories: LegacyCategory[], subcategories: LegacySubcategory[]): CategoryProfile[] {
  const titleRules = new Map(subcategories.map(item => [normalizeMatchText(item.nome), item]));
  const usedIds = new Set<string>();
  const profiles: CategoryProfile[] = categories.filter(item => String(item.nome || '').trim()).map(category => {
    const name = String(category.nome).trim();
    const baseId = slugifyCategory(name);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    const title = titleRules.get(normalizeMatchText(name));
    titleRules.delete(normalizeMatchText(name));
    return {
      id,
      name,
      status: 'draft',
      profileType: 'compact',
      parentId: null,
      aliases: [name],
      negativeTerms: [],
      requiredFields: list(category.camposObrigatorios ?? category.campos),
      optionalFields: list(category.camposOpcionais),
      idealSheet: String(category.fichaIdeal ?? category.ficha ?? '').trim(),
      sheetNoticeType: String(category.avisoFichaTipo || 'normal'),
      titleRule: { formula: String(title?.formula || ''), example: String(title?.ex || '') },
      modifiers: [],
      qaSchema: category.qaSchema && typeof category.qaSchema === 'object' ? category.qaSchema as Record<string, unknown> : null,
      schemaVersion: 2,
      revision: 1,
      source: 'legacy-migration',
    };
  });

  for (const title of titleRules.values()) {
    const name = String(title.nome || '').trim();
    if (!name) continue;
    const baseId = slugifyCategory(name);
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    profiles.push({
      id, name, status: 'draft', profileType: 'compact', parentId: null,
      aliases: [name], negativeTerms: [], requiredFields: [], optionalFields: [], idealSheet: '',
      sheetNoticeType: 'normal', titleRule: { formula: String(title.formula || ''), example: String(title.ex || '') },
      modifiers: [], qaSchema: null, schemaVersion: 2, revision: 1, source: 'legacy-migration',
    });
  }

  return profiles.map(profile => ({ ...profile, parentId: findParent(profile, profiles) }));
}
