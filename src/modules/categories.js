/**
 * modules/categories.js
 * ──────────────────────
 * Fachada do catálogo: o backend é a autoridade de leitura operacional,
 * resolução e mutações. Firestore direto existe somente para ler o legado
 * durante a migração; localStorage acelera a primeira pintura da interface.
 */

import { CategoriesDB } from '../firebase/firestore.js';
import {
  buildCategoryPayload,
  normalizeCategory,
} from './categoryQaSchema.js';
import { UserAccess } from '../services/userAccess.js';
import { CategoryCatalogApi } from '../services/categoryCatalog.js';
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
let _changeTimer = null; // throttle do evento catsChanged

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
  },

  // ─── Sincronização de leitura durante a migração ──────────
  /**
   * Observa somente a coleção legada e busca o catálogo atual no backend.
   * Alterações novas chamam refresh explicitamente após a resposta da API.
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
    return (await this.resolveDetailed(input)).categories;
  },

  async resolveDetailed(input) {
    if (!_backendAvailable) await this.refresh();
    const payload = await CategoryCatalogApi.resolve(input);
    const categories = payload.resolution?.compiledProfile
      ? [normalizeCategory(payload.resolution.compiledProfile)]
      : [];
    const titleRule = payload.titleRule ? {
      id: payload.titleRule.id,
      nome: payload.titleRule.name,
      formula: payload.titleRule.formula,
      ex: payload.titleRule.example || '',
      confidence: Number(payload.titleRule.confidence || 0),
    } : null;
    return { categories, titleRule, catalogVersion: Number(payload.catalogVersion || 0) };
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

};
