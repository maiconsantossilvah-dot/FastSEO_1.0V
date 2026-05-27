/**
 * modules/categories.js
 * ──────────────────────
 * CRUD de categorias com Firestore como fonte primária
 * e localStorage como cache offline/fallback.
 */

import { CategoriesDB }  from '../firebase/firestore.js';
import {
  buildCategoryPayload,
  needsCategoryMigration,
  normalizeCategory,
} from './categoryQaSchema.js';
const LS_CATS = 'ficha_categorias'; // chave de cache local

// Cache em memória (atualizado pelo listener em tempo real)
let _cache = [];
let _changeTimer = null; // throttle do evento catsChanged
const _migrationQueue = new Set();

export const Categories = {
  // ─── Cache local ─────────────────────────────────────────
  getAll() { return _cache; },

  _writeCache(cats) {
    _cache = (cats || []).map(normalizeCategory);
    try { localStorage.setItem(LS_CATS, JSON.stringify(_cache)); } catch (_) {}
  },

  _readLocalFallback() {
    try { return (JSON.parse(localStorage.getItem(LS_CATS) || '[]') || []).map(normalizeCategory); }
    catch { return []; }
  },

  find(id) { return _cache.find(c => c.id === id) || null; },

  // ─── CRUD assíncrono (Firestore) ─────────────────────────
  async create() {
    const data = buildCategoryPayload({
      nome: 'Nova Categoria',
      camposObrigatorios: [],
      camposOpcionais: [],
      fichaIdeal: '',
    });
    const created = await CategoriesDB.create(data);
    return normalizeCategory(created);
  },

  async update(id, data) {
    const previous = this.find(id) || {};
    await CategoriesDB.update(id, buildCategoryPayload(data, previous));
  },

  async delete(id) {
    await CategoriesDB.delete(id);
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
    _cache = this._readLocalFallback();

    return CategoriesDB.listen(cats => {
      this._writeCache(cats);
      this._migrateLegacyCategories(cats);
      // Throttle: dispara o evento no máximo 1x a cada 200ms para evitar
      // múltiplos re-renders em cascata durante sincronizações do Firestore
      clearTimeout(_changeTimer);
      _changeTimer = setTimeout(() => {
        document.dispatchEvent(new CustomEvent('fastseo:catsChanged'));
      }, 200);
    });
  },

  _migrateLegacyCategories(cats) {
    (cats || []).forEach(cat => {
      if (!cat?.id || !needsCategoryMigration(cat) || _migrationQueue.has(cat.id)) return;
      _migrationQueue.add(cat.id);
      CategoriesDB.update(cat.id, buildCategoryPayload({}, cat))
        .catch(err => console.warn('[Categories] Erro ao migrar categoria:', err))
        .finally(() => _migrationQueue.delete(cat.id));
    });
  },
};
