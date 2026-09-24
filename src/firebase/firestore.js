/**
 * firebase/firestore.js
 * ─────────────────────
 * Expõe leituras em tempo real protegidas pelas Rules. Toda persistência de
 * prompts e histórico passa pelo backend autenticado e validado.
 *
 * Importa db do firebase.js central — não inicializa de novo.
 *
 * Estrutura Firestore:
 *   /categories/{docId}       → { id, nome, campos, ficha, copy, updatedAt }
 *   /subcategories/{docId}    → { nome, formula, ex }
 *   /prompts/{docId}          → { key, value, updatedAt }
 *   /users/{uid}/history/{docId} → histórico privado do usuário autenticado
 */

import { db } from './firebase.js';
import { UserAccess } from '../services/userAccess.js';

import {
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Referências de coleções ──────────────────────────────────
const Refs = {
  categories:    () => collection(db, 'categories'),
  prompts:       () => collection(db, 'prompts'),
  history:       uid => collection(db, 'users', uid, 'history'),
};

function currentUid() {
  const uid = UserAccess.current().user?.uid;
  if (!uid) throw new Error('Usuário autenticado não encontrado para acessar o histórico.');
  return uid;
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────
export const CategoriesDB = {
  async getAll() {
    const snap = await getDocs(query(Refs.categories(), orderBy('nome')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  listen(callback) {
    return onSnapshot(
      query(Refs.categories(), orderBy('nome')),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[CategoriesDB] Listener error:', err)
    );
  },
};

// ─────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────
export const PromptsDB = {
  async getAll() {
    const snap = await getDocs(Refs.prompts());
    const obj = {};
    snap.docs.forEach(d => { obj[d.id] = d.data().value; });
    return obj;
  },

  async save(key, value) {
    UserAccess.assert('editPrompts');
    await UserAccess.request(`/prompts/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },

  async delete(key) {
    UserAccess.assert('editPrompts');
    await UserAccess.request(`/prompts/${encodeURIComponent(key)}`, { method: 'DELETE' });
  },

  listen(callback) {
    return onSnapshot(
      Refs.prompts(),
      snap => {
        const obj = {};
        snap.docs.forEach(d => { obj[d.id] = d.data().value; });
        callback(obj);
      },
      err => console.error('[PromptsDB] Listener error:', err)
    );
  },
};

// ─────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────
export const HistoryDB = {
  async getRecent(n = 50) {
    const history = Refs.history(currentUid());
    const snap = await getDocs(
      query(history, orderBy('ts', 'desc'), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async save(data) {
    UserAccess.assert('editContent');
    const result = await UserAccess.request('/history', {
      method: 'POST',
      body: JSON.stringify({
      preview:  data.preview  || '',
      ficha:    data.ficha    || '',
      conteudo: data.conteudo || '',
      bivolt:   !!data.bivolt,
      tokenUsage: data.tokenUsage || null,
      }),
    });
    return result.id;
  },

  async updateResult(id, data) {
    UserAccess.assert('editContent');
    if (!id) return;
    await UserAccess.request(`/history/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        conteudo: data.conteudo || '',
        tokenUsage: data.tokenUsage || null,
      }),
    });
  },

  async clearAll() {
    UserAccess.assert('editContent');
    await UserAccess.request('/history', { method: 'DELETE' });
  },

  listen(callback) {
    const history = Refs.history(currentUid());
    return onSnapshot(
      query(history, orderBy('ts', 'desc'), limit(50)),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[HistoryDB] Listener error:', err)
    );
  },
};

export { db };
