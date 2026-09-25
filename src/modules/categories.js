/**
 * modules/categories.js
 * ──────────────────────
 * Fachada do catálogo: o backend é a autoridade de leitura operacional,
 * resolução e mutações. O legado também chega pela API para que cada navegador
 * não abra sua própria varredura do Firestore; localStorage acelera a pintura.
 */

import {
  buildCategoryPayload,
  normalizeCategory,
} from './categoryQaSchema.js';
import { UserAccess } from '../services/userAccess.js';
import { CategoryCatalogApi } from '../services/categoryCatalog.js';
import { createProductSource } from './pipelineDomain.js';
const LS_CATS = 'ficha_categorias'; // chave de cache local

// Caches em memória separados evitam misturar rascunhos com o catálogo publicado.
let _cache = [];
let _editableCache = [];
let _legacyCache = [];
let _publishedBackendCache = [];
let _backendAvailable = false;
let _catalogVersion = 0;
let _backendProfileIds = new Set();
const _promotionQueue = new Map();

function canonicalIdentityToken(token) {
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

function normalizeIdentityText(value) {
  return String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(canonicalIdentityToken)
    .join(' ');
}

function titleContainsEvidence(title, evidence) {
  const normalizedTitle = normalizeIdentityText(title);
  const normalizedEvidence = normalizeIdentityText(evidence);
  if (!normalizedTitle || !normalizedEvidence) return false;
  return ` ${normalizedTitle} `.includes(` ${normalizedEvidence} `);
}

function emitChanged(kind = 'draft', affectsResolution = false) {
  document.dispatchEvent(new CustomEvent('fastseo:catsChanged', {
    detail: { kind, affectsResolution },
  }));
}

function upsertById(categories, next) {
  const found = categories.some(category => category.id === next.id);
  return found
    ? categories.map(category => category.id === next.id ? next : category)
    : [...categories, next];
}

function mergePublishedWithLegacy() {
  if (!_publishedBackendCache.length) return _legacyCache;
  const publishedNames = new Set(_publishedBackendCache.map(cat => String(cat.nome || '').toLocaleLowerCase('pt-BR').trim()));
  return [
    ..._publishedBackendCache,
    ..._legacyCache.filter(cat => !publishedNames.has(String(cat.nome || '').toLocaleLowerCase('pt-BR').trim())),
  ];
}

export const Categories = {
  // ─── Cache local ─────────────────────────────────────────
  getAll() { return _cache; },
  getEditable() {
    if (!_backendAvailable || !UserAccess.can('manageCategoryCatalog')) return _cache;
    const workingNames = new Set(_editableCache.map(cat => String(cat.nome || '').toLocaleLowerCase('pt-BR').trim()));
    const legacyOnly = _legacyCache
      .filter(cat => !workingNames.has(String(cat.nome || '').toLocaleLowerCase('pt-BR').trim()))
      .map(cat => normalizeCategory({ ...cat, status: 'legacy' }));
    return [..._editableCache, ...legacyOnly];
  },
  catalogVersion() { return _catalogVersion; },
  usesBackend() { return _backendAvailable; },

  _writeCache(cats) {
    _cache = (cats || []).map(normalizeCategory);
    try { localStorage.setItem(LS_CATS, JSON.stringify(_cache)); }
    catch { /* Cache é apenas uma otimização de leitura. */ }
  },

  _readLocalFallback() {
    try { return (JSON.parse(localStorage.getItem(LS_CATS) || '[]') || []).map(normalizeCategory); }
    catch { return []; }
  },

  find(id) { return this.getEditable().find(c => c.id === id) || _cache.find(c => c.id === id) || null; },
  isBackendProfile(id) { return _backendProfileIds.has(id); },

  // ─── CRUD assíncrono (backend autenticado) ───────────────
  async create() {
    const data = buildCategoryPayload({
      nome: 'Nova Categoria',
      avisoFichaTipo: 'normal',
      camposObrigatorios: [],
      camposOpcionais: [],
      fichaIdeal: '',
    });
    UserAccess.assert('manageCategoryCatalog');
    if (!_backendAvailable) throw new Error('O backend de categorias está indisponível. Tente novamente após atualizar o catálogo.');
    const created = normalizeCategory(await CategoryCatalogApi.create(data));
    _editableCache = [..._editableCache, created];
    _backendProfileIds.add(created.id);
    emitChanged();
    return created;
  },

  async update(id, data) {
    const previous = this.find(id) || {};
    const payload = buildCategoryPayload(data, previous);
    const next = normalizeCategory({ ...previous, ...payload, id });
    UserAccess.assert('manageCategoryCatalog');
    if (!_backendAvailable) throw new Error('O backend de categorias está indisponível. Nenhuma alteração foi salva.');
    await this._ensureBackendProfile(id);
    const beforeEditable = _editableCache;
    _editableCache = _editableCache.map(cat => cat.id === id ? next : cat);
    emitChanged();
    try {
      const saved = normalizeCategory(await CategoryCatalogApi.update(
        id,
        { ...payload, status: 'draft' },
        Number(previous.revision || 1),
      ));
      _editableCache = _editableCache.map(cat => cat.id === id ? saved : cat);
      emitChanged();
      return saved;
    } catch (err) {
      _editableCache = beforeEditable;
      emitChanged();
      throw err;
    }
  },

  async delete(id) {
    UserAccess.assert('manageCategoryCatalog');
    if (!_backendAvailable) throw new Error('O backend de categorias está indisponível. Nenhuma categoria foi excluída.');
    const beforeEditable = _editableCache;
    const beforeLegacy = _legacyCache;
    const beforePublished = _publishedBackendCache;
    _editableCache = _editableCache.filter(cat => cat.id !== id);
    _legacyCache = _legacyCache.filter(cat => cat.id !== id);
    _publishedBackendCache = _publishedBackendCache.filter(cat => cat.id !== id);
    _backendProfileIds.delete(id);
    this._writeCache(mergePublishedWithLegacy());
    emitChanged('deleted', true);
    try {
      const result = await CategoryCatalogApi.delete(id);
      _catalogVersion = Number(result.catalogVersion || _catalogVersion);
    } catch (err) {
      _editableCache = beforeEditable;
      _legacyCache = beforeLegacy;
      _publishedBackendCache = beforePublished;
      _backendProfileIds = new Set(beforeEditable.map(cat => cat.id));
      this._writeCache(mergePublishedWithLegacy());
      emitChanged('rollback', true);
      throw err;
    }
  },

  // ─── Sincronização de leitura durante a migração ──────────
  /**
   * Restaura o cache local e busca catálogo publicado + legado pelo backend.
   * Não abre listener Firestore por usuário; mutações locais atualizam o cache.
   *
   * @returns {Function} unsubscribe — chame para parar o listener
   */
  startSync({ remote = !UserAccess.isDegraded() } = {}) {
    const cached = CategoryCatalogApi.cachedCatalog();
    _publishedBackendCache = (cached?.profiles || []).map(normalizeCategory);
    _legacyCache = (cached?.legacyProfiles || []).map(normalizeCategory);
    _cache = cached ? mergePublishedWithLegacy() : this._readLocalFallback();
    _editableCache = _cache;

    if (!remote) {
      _backendAvailable = false;
      emitChanged('local-cache', false);
      return () => {};
    }

    this.refresh().catch(err => {
      if (!CategoryCatalogApi.isUnavailable(err)) console.warn('[Categories] Catálogo backend indisponível:', err);
    });

    return () => {};
  },

  async refresh() {
    const catalog = await CategoryCatalogApi.getCatalog();
    _backendAvailable = true;
    _catalogVersion = Number(catalog.version || 0);
    _publishedBackendCache = catalog.profiles.map(normalizeCategory);
    _legacyCache = (catalog.legacyProfiles || []).map(normalizeCategory);
    this._writeCache(mergePublishedWithLegacy());

    if (UserAccess.can('manageCategoryCatalog')) {
      const working = await CategoryCatalogApi.getProfiles();
      _editableCache = working.profiles.map(normalizeCategory);
      _backendProfileIds = new Set(_editableCache.map(cat => cat.id));
    } else {
      _editableCache = catalog.profiles.map(normalizeCategory);
    }
    emitChanged('catalog', true);
    return { catalog: _cache, editable: _editableCache };
  },

  async publish(id) {
    UserAccess.assert('manageCategoryCatalog');
    if (!_backendAvailable) throw new Error('Publique categorias somente após atualizar o backend.');
    await this._ensureBackendProfile(id);
    const result = await CategoryCatalogApi.publish(id);
    const published = normalizeCategory(result.profile);
    _catalogVersion = Number(result.catalogVersion || _catalogVersion);
    _publishedBackendCache = upsertById(_publishedBackendCache, published);
    _editableCache = upsertById(_editableCache, published);
    _backendProfileIds.add(published.id);
    this._writeCache(mergePublishedWithLegacy());
    emitChanged('published', true);
    return published;
  },

  async _ensureBackendProfile(id) {
    if (_backendProfileIds.has(id)) return this.find(id);
    if (_promotionQueue.has(id)) return _promotionQueue.get(id);
    const legacy = _legacyCache.find(cat => cat.id === id) || _cache.find(cat => cat.id === id);
    if (!legacy) throw new Error('Categoria não encontrada no catálogo local.');

    const promotion = (async () => {
      await CategoryCatalogApi.commitImport([{ ...legacy, status: 'draft', source: 'legacy-migration' }]);
      await this.refresh();
      const promoted = _editableCache.find(cat => cat.id === id);
      if (!promoted) throw new Error('Não foi possível promover a categoria legada para rascunho.');
      return promoted;
    })().finally(() => _promotionQueue.delete(id));
    _promotionQueue.set(id, promotion);
    return promotion;
  },

  async resolve(input) {
    return (await this.resolveDetailed(input)).categories;
  },

  async resolveDetailed(input) {
    if (UserAccess.isDegraded()) {
      return {
        categories: [],
        titleRule: null,
        catalogVersion: _catalogVersion,
        degraded: true,
        categoryMatch: {
          reason: 'NO_IDENTITY_EVIDENCE', confidence: 0, score: 0, runnerUpScore: 0,
          evidenceZone: 'none', evidence: [], evidenceKind: 'none', candidate: null, matcherVersion: 'local-degraded',
        },
        productSource: createProductSource(input),
      };
    }
    if (!_backendAvailable) await this.refresh();
    const payload = await CategoryCatalogApi.resolve(input);
    let categories = payload.resolution?.compiledProfile
      ? [normalizeCategory(payload.resolution.compiledProfile)]
      : [];
    let categoryMatch = payload.categoryMatch ? {
      ...payload.categoryMatch,
      evidence: payload.categoryMatch.evidence?.length
        ? payload.categoryMatch.evidence
        : payload.resolution?.evidence || [],
      candidate: payload.categoryMatch.candidate || payload.resolution?.family || null,
      matcherVersion: payload.categoryMatch.matcherVersion || 'legacy-or-unknown',
    } : null;
    const titleRule = payload.titleRule ? {
      id: payload.titleRule.id,
      nome: payload.titleRule.name,
      formula: payload.titleRule.formula,
      ex: payload.titleRule.example || '',
      confidence: Number(payload.titleRule.confidence || 0),
    } : null;
    const productSource = {
      ...createProductSource(input),
      ...(payload.productSource || {}),
      rawText: String(input || '').trim(),
    };
    // Valida um invariante, sem executar um segundo ranking no navegador: a
    // evidência vencedora precisa existir como frase no título canônico. Isso
    // bloqueia respostas de backends antigos que encontravam a categoria em
    // qualquer trecho do corpo do produto.
    if (categories.length && categoryMatch) {
      const identityConfirmed = categoryMatch.evidence
        .some(item => titleContainsEvidence(productSource.title, item));
      if (!identityConfirmed) {
        categories = [];
        categoryMatch = {
          ...categoryMatch,
          reason: 'NO_IDENTITY_EVIDENCE',
          confidence: 0,
          evidenceZone: 'none',
          rejectedOutOfTitleEvidence: true,
        };
      }
    }
    return {
      categories,
      titleRule,
      categoryMatch,
      productSource,
      catalogVersion: Number(payload.catalogVersion || 0),
    };
  },

  async previewLegacyMigration() {
    UserAccess.assert('manageCategoryCatalog');
    return CategoryCatalogApi.previewLegacyMigration();
  },

  async exportBackup() {
    UserAccess.assert('manageCategoryCatalog');
    return CategoryCatalogApi.exportBackup();
  },

  async migrateLegacy(previewId) {
    UserAccess.assert('manageCategoryCatalog');
    const result = await CategoryCatalogApi.commitLegacyMigration(previewId);
    await this.refresh();
    return result;
  },

  async previewImport(categories) {
    UserAccess.assert('manageCategoryCatalog');
    return CategoryCatalogApi.previewImport(categories);
  },

  async importBatch(categories) {
    UserAccess.assert('manageCategoryCatalog');
    const result = await CategoryCatalogApi.commitImport(categories);
    await this.refresh();
    return result;
  },

};
