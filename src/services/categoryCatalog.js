import { UserAccess, UsersApiError } from './userAccess.js';

const CACHE_KEY = 'fastseo_category_catalog_v2';

function list(value) {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return String(value || '').split(/\r?\n|;|,/).map(item => item.trim()).filter(Boolean);
}

function modifierFromBackend(modifier = {}) {
  return {
    id: modifier.id || '',
    nome: modifier.name || modifier.nome || '',
    aliases: list(modifier.aliases),
    negativeTerms: list(modifier.negativeTerms),
    camposObrigatorios: list(modifier.addRequiredFields || modifier.camposObrigatorios),
    camposOpcionais: list(modifier.addOptionalFields || modifier.camposOpcionais),
    titleSuffix: modifier.titleSuffix || '',
  };
}

export function categoryFromBackend(profile = {}) {
  return {
    id: profile.id,
    nome: profile.name || profile.nome || 'Sem nome',
    status: profile.status || 'published',
    profileType: profile.profileType || 'compact',
    parentId: profile.parentId || null,
    aliases: list(profile.aliases),
    negativeTerms: list(profile.negativeTerms),
    camposObrigatorios: list(profile.requiredFields || profile.camposObrigatorios),
    camposOpcionais: list(profile.optionalFields || profile.camposOpcionais),
    fichaIdeal: profile.idealSheet ?? profile.fichaIdeal ?? '',
    avisoFichaTipo: profile.sheetNoticeType || profile.avisoFichaTipo || 'normal',
    titleRule: profile.titleRule || { formula: '', example: '' },
    modifiers: (profile.modifiers || []).map(modifierFromBackend),
    qaSchema: profile.qaSchema || null,
    schemaVersion: profile.schemaVersion || 2,
    revision: profile.revision || 1,
    source: profile.source || 'manual',
    publishedVersion: profile.publishedVersion || null,
  };
}

function modifierToBackend(modifier = {}, index = 0) {
  const name = modifier.nome || modifier.name || `Modificador ${index + 1}`;
  const id = String(modifier.id || name).toLocaleLowerCase('pt-BR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: id || `modificador-${index + 1}`,
    name,
    aliases: list(modifier.aliases),
    negativeTerms: list(modifier.negativeTerms),
    addRequiredFields: list(modifier.camposObrigatorios || modifier.addRequiredFields),
    addOptionalFields: list(modifier.camposOpcionais || modifier.addOptionalFields),
    titleSuffix: modifier.titleSuffix || '',
  };
}

export function categoryToBackend(category = {}) {
  return {
    name: category.nome || category.name || 'Sem nome',
    status: category.status || 'draft',
    profileType: category.profileType || 'compact',
    parentId: category.parentId || null,
    aliases: list(category.aliases),
    negativeTerms: list(category.negativeTerms),
    requiredFields: list(category.camposObrigatorios || category.requiredFields),
    optionalFields: list(category.camposOpcionais || category.optionalFields),
    idealSheet: category.fichaIdeal ?? category.idealSheet ?? '',
    sheetNoticeType: category.avisoFichaTipo || category.sheetNoticeType || 'normal',
    titleRule: {
      formula: category.titleRule?.formula || '',
      example: category.titleRule?.example || category.titleRule?.ex || '',
    },
    modifiers: (category.modifiers || []).map(modifierToBackend),
    qaSchema: category.qaSchema || null,
    schemaVersion: 2,
    source: category.source || 'manual',
  };
}

function saveCache(payload) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(payload)); } catch {}
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

export const CategoryCatalogApi = {
  isUnavailable(error) {
    return error instanceof UsersApiError && ['BACKEND_UNAVAILABLE', 'NOT_FOUND'].includes(error.code);
  },

  cachedCatalog() {
    const cached = readCache();
    return cached ? { ...cached, profiles: (cached.profiles || []).map(categoryFromBackend) } : null;
  },

  async getCatalog() {
    const payload = await UserAccess.request('/category-catalog');
    saveCache(payload);
    return { ...payload, profiles: (payload.profiles || []).map(categoryFromBackend) };
  },

  async getProfiles() {
    const payload = await UserAccess.request('/category-profiles');
    return { ...payload, profiles: (payload.profiles || []).map(categoryFromBackend) };
  },

  exportBackup() {
    return UserAccess.request('/category-profiles/export');
  },

  async create(category) {
    const payload = await UserAccess.request('/category-profiles', {
      method: 'POST', body: JSON.stringify(categoryToBackend(category)),
    });
    return categoryFromBackend(payload.profile);
  },

  async update(id, category) {
    const payload = await UserAccess.request(`/category-profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: JSON.stringify(categoryToBackend(category)),
    });
    return categoryFromBackend(payload.profile);
  },

  async delete(id) {
    return UserAccess.request(`/category-profiles/${encodeURIComponent(id)}/permanent`, { method: 'DELETE' });
  },

  async publish(id) {
    return UserAccess.request(`/category-profiles/${encodeURIComponent(id)}/publish`, { method: 'POST' });
  },

  async resolve(input) {
    const payload = await UserAccess.request('/category-resolve', {
      method: 'POST', body: JSON.stringify({ input }),
    });
    if (payload.resolution?.compiledProfile) {
      payload.resolution.compiledProfile = categoryFromBackend(payload.resolution.compiledProfile);
    }
    return payload;
  },

  previewLegacyMigration() {
    return UserAccess.request('/category-profiles/migrate-legacy/preview', { method: 'POST' });
  },

  commitLegacyMigration() {
    return UserAccess.request('/category-profiles/migrate-legacy/commit', { method: 'POST' });
  },

  previewImport(categories) {
    return UserAccess.request('/category-profiles/import/preview', {
      method: 'POST',
      body: JSON.stringify({ profiles: categories.map(category => ({ id: category.id, ...categoryToBackend(category), source: 'import' })) }),
    });
  },

  commitImport(categories) {
    return UserAccess.request('/category-profiles/import/commit', {
      method: 'POST',
      body: JSON.stringify({ profiles: categories.map(category => ({ id: category.id, ...categoryToBackend(category), source: 'import' })) }),
    });
  },
};
