/**
 * modules/categories.js
 * ──────────────────────
 * CRUD de categorias com Firestore como fonte primária
 * e localStorage como cache offline/fallback.
 */

import { CategoriesDB }  from '../firebase/firestore.js';
import { SidebarUI }     from '../components/SidebarUI.js';

const LS_CATS = 'ficha_categorias'; // chave de cache local

// Cache em memória (atualizado pelo listener em tempo real)
let _cache = [];

export const Categories = {
  // ─── Cache local ─────────────────────────────────────────
  getAll() { return _cache; },

  _writeCache(cats) {
    _cache = cats;
    try { localStorage.setItem(LS_CATS, JSON.stringify(cats)); } catch (_) {}
  },

  _readLocalFallback() {
    try { return JSON.parse(localStorage.getItem(LS_CATS) || '[]') || []; }
    catch { return []; }
  },

  find(id) { return _cache.find(c => c.id === id) || null; },

  // ─── CRUD assíncrono (Firestore) ─────────────────────────
  async create() {
    const data = { nome: 'Nova Categoria', campos: '', ficha: '', copy: '' };
    const created = await CategoriesDB.create(data);
    return created;
  },

  async update(id, data) {
    await CategoriesDB.update(id, data);
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
      SidebarUI.render(); // re-render automático quando dados mudam
    });
  },
};
