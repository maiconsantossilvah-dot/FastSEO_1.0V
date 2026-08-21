/**
 * modules/categories.js
 * ──────────────────────
 * CRUD de categorias com Firestore como fonte primária
 * e localStorage como cache offline/fallback.
 */

import { CategoriesDB } from '../firebase/firestore.js';
import {
  buildCategoryPayload,
  needsCategoryMigration,
  normalizeCategory,
} from './categoryQaSchema.js';
import { UserAccess } from '../services/userAccess.js';
import { CategoryCatalogApi } from '../services/categoryCatalog.js';
const LS_CATS = 'ficha_categorias'; // chave de cache local

// Cache em memória (atualizado pelo listener em tempo real)
let _cache = [];
let _editableCache = [];
let _legacyCache = [];
let _publishedBackendCache = [];
let _backendAvailable = false;
let _catalogVersion = 0;
let _backendProfileIds = new Set();
const _promotionQueue = new Map();
let _changeTimer = null; // throttle do evento catsChanged
const _migrationQueue = new Set();

function emitChanged() {
  document.dispatchEvent(new CustomEvent('fastseo:catsChanged'));
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
    try { localStorage.setItem(LS_CATS, JSON.stringify(_cache)); } catch (_) { }
  },

  _readLocalFallback() {
    try { return (JSON.parse(localStorage.getItem(LS_CATS) || '[]') || []).map(normalizeCategory); }
    catch { return []; }
  },

  find(id) { return this.getEditable().find(c => c.id === id) || _cache.find(c => c.id === id) || null; },
  isBackendProfile(id) { return _backendProfileIds.has(id); },

  // ─── CRUD assíncrono (Firestore) ─────────────────────────
  async create() {
    const data = buildCategoryPayload({
      nome: 'Nova Categoria',
      avisoFichaTipo: 'normal',
      camposObrigatorios: [],
      camposOpcionais: [],
      fichaIdeal: '',
    });
    if (_backendAvailable) {
      UserAccess.assert('manageCategoryCatalog');
      const created = normalizeCategory(await CategoryCatalogApi.create(data));
      _editableCache = [..._editableCache, created];
      _backendProfileIds.add(created.id);
      emitChanged();
      return created;
    }
    const created = await CategoriesDB.create(data);
    const normalized = normalizeCategory(created);
    if (!this.find(normalized.id)) {
      this._writeCache([..._cache, normalized]);
      emitChanged();
    }
    return normalized;
  },

  async update(id, data) {
    const previous = this.find(id) || {};
    const payload = buildCategoryPayload(data, previous);
    const next = normalizeCategory({ ...previous, ...payload, id });
    if (_backendAvailable) {
      UserAccess.assert('manageCategoryCatalog');
      await this._ensureBackendProfile(id);
      const beforeEditable = _editableCache;
      _editableCache = _editableCache.map(cat => cat.id === id ? next : cat);
      emitChanged();
      try {
        const saved = normalizeCategory(await CategoryCatalogApi.update(id, { ...payload, status: 'draft' }));
        _editableCache = _editableCache.map(cat => cat.id === id ? saved : cat);
        emitChanged();
        return saved;
      } catch (err) {
        _editableCache = beforeEditable;
        emitChanged();
        throw err;
      }
    }
    const before = _cache;
    const exists = _cache.some(cat => cat.id === id);
    this._writeCache(exists ? _cache.map(cat => cat.id === id ? next : cat) : [..._cache, next]);
    emitChanged();
    try {
      await CategoriesDB.update(id, payload);
    } catch (err) {
      this._writeCache(before);
      emitChanged();
      throw err;
    }
  },

  async delete(id) {
    if (_backendAvailable) {
      UserAccess.assert('manageCategoryCatalog');
      const beforeEditable = _editableCache;
      const beforeLegacy = _legacyCache;
      const beforePublished = _publishedBackendCache;
      _editableCache = _editableCache.filter(cat => cat.id !== id);
      _legacyCache = _legacyCache.filter(cat => cat.id !== id);
      _publishedBackendCache = _publishedBackendCache.filter(cat => cat.id !== id);
      _backendProfileIds.delete(id);
      this._writeCache(mergePublishedWithLegacy());
      emitChanged();
      try {
        await CategoryCatalogApi.delete(id);
        await this.refresh();
      } catch (err) {
        _editableCache = beforeEditable;
        _legacyCache = beforeLegacy;
        _publishedBackendCache = beforePublished;
        _backendProfileIds = new Set(beforeEditable.map(cat => cat.id));
        this._writeCache(mergePublishedWithLegacy());
        emitChanged();
        throw err;
      }
      return;
    }
    const before = _cache;
    this._writeCache(_cache.filter(cat => cat.id !== id));
    emitChanged();
    try {
      await CategoriesDB.delete(id);
    } catch (err) {
      this._writeCache(before);
      emitChanged();
      throw err;
    }
  },

  // ─── Listener em tempo real ───────────────────────────────
  /**
   * Inicia a sincronização em tempo real com o Firestore.
   * Toda mudança (local ou de outro usuário) atualiza o cache
   * e dispara o re-render da Sidebar automaticamente.
   *
   * @returns {Function} unsubscribe — chame para parar o listener
   */
  startSync() {
    // Carrega cache local enquanto Firestore ainda não respondeu
    _cache = CategoryCatalogApi.cachedCatalog()?.profiles || this._readLocalFallback();
    _editableCache = _cache;
    let stopped = false;

    const unsubscribeLegacy = CategoriesDB.listen(cats => {
      if (stopped) return;
      _legacyCache = (cats || []).map(normalizeCategory);
      this._writeCache(mergePublishedWithLegacy());
      if (!_backendAvailable || !_editableCache.length) _editableCache = (cats || []).map(normalizeCategory);
      if (!_backendAvailable) this._migrateLegacyCategories(cats);
      // Throttle: dispara o evento no máximo 1x a cada 200ms para evitar
      // múltiplos re-renders em cascata durante sincronizações do Firestore
      clearTimeout(_changeTimer);
      _changeTimer = setTimeout(() => {
        emitChanged();
      }, 200);
    });

    this.refresh().catch(err => {
      if (!CategoryCatalogApi.isUnavailable(err)) console.warn('[Categories] Catálogo backend indisponível:', err);
    });

    return () => {
      stopped = true;
      unsubscribeLegacy?.();
    };
  },

  async refresh() {
    const catalog = await CategoryCatalogApi.getCatalog();
    _backendAvailable = true;
    _catalogVersion = Number(catalog.version || 0);
    _publishedBackendCache = catalog.profiles.map(normalizeCategory);
    if (_publishedBackendCache.length) this._writeCache(mergePublishedWithLegacy());

    if (UserAccess.can('manageCategoryCatalog')) {
      const working = await CategoryCatalogApi.getProfiles();
      _editableCache = working.profiles.map(normalizeCategory);
      _backendProfileIds = new Set(_editableCache.map(cat => cat.id));
    } else {
      _editableCache = catalog.profiles.map(normalizeCategory);
    }
    emitChanged();
    return { catalog: _cache, editable: _editableCache };
  },

  async publish(id) {
    UserAccess.assert('manageCategoryCatalog');
    if (!_backendAvailable) throw new Error('Publique categorias somente após atualizar o backend.');
    await this._ensureBackendProfile(id);
    await CategoryCatalogApi.publish(id);
    await this.refresh();
    return this.find(id);
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
    if (!_backendAvailable || !_catalogVersion) return null;
    try {
      const payload = await CategoryCatalogApi.resolve(input);
      return payload.resolution?.compiledProfile
        ? [normalizeCategory(payload.resolution.compiledProfile)]
        : null;
    } catch (error) {
      console.warn('[Categories] Falha no resolvedor do backend; usando matcher local.', error);
      return null;
    }
  },

  async previewLegacyMigration() {
    UserAccess.assert('manageCategoryCatalog');
    return CategoryCatalogApi.previewLegacyMigration();
  },

  async exportBackup() {
    UserAccess.assert('manageCategoryCatalog');
    return CategoryCatalogApi.exportBackup();
  },

  async migrateLegacy() {
    UserAccess.assert('manageCategoryCatalog');
    const result = await CategoryCatalogApi.commitLegacyMigration();
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

  _migrateLegacyCategories(cats) {
    if (!UserAccess.can('editContent')) return;
    (cats || []).forEach(cat => {
      if (!cat?.id || !needsCategoryMigration(cat) || _migrationQueue.has(cat.id)) return;
      _migrationQueue.add(cat.id);
      CategoriesDB.update(cat.id, buildCategoryPayload({}, cat))
        .catch(err => console.warn('[Categories] Erro ao migrar categoria:', err))
        .finally(() => _migrationQueue.delete(cat.id));
    });
  },
};
