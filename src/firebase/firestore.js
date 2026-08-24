/**
 * firebase/firestore.js
 * ─────────────────────
 * Expõe CRUD + listeners em tempo real para as coleções:
 * categories, subcategories, prompts, history
 *
 * Importa db do firebase.js central — não inicializa de novo.
 *
 * Estrutura Firestore:
 *   /categories/{docId}       → { id, nome, campos, ficha, copy, updatedAt }
 *   /subcategories/{docId}    → { nome, formula, ex }
 *   /prompts/{docId}          → { key, value, updatedAt }
 *   /history/{docId}          → { preview, ficha, conteudo, bivolt, tokenUsage, data, ts }
 */

import { db } from './firebase.js';
import { UserAccess } from '../services/userAccess.js';

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── Referências de coleções ──────────────────────────────────
const Refs = {
  categories:    () => collection(db, 'categories'),
  subcategories: () => collection(db, 'subcategories'),
  prompts:       () => collection(db, 'prompts'),
  history:       () => collection(db, 'history'),
};

function cleanUndefined(data) {
  return Object.fromEntries(
    Object.entries(data || {}).filter(([, value]) => value !== undefined)
  );
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────
export const CategoriesDB = {
  async getAll() {
    const snap = await getDocs(query(Refs.categories(), orderBy('nome')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async create(data) {
    UserAccess.assert('editContent');
    const payload = cleanUndefined({
      ...data,
      nome: data.nome || 'Nova Categoria',
      updatedAt: serverTimestamp(),
    });
    const ref = await addDoc(Refs.categories(), payload);
    return { id: ref.id, ...payload };
  },

  async update(id, data) {
    UserAccess.assert('editContent');
    await updateDoc(doc(db, 'categories', id), {
      ...cleanUndefined(data),
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id) {
    UserAccess.assert('editContent');
    await deleteDoc(doc(db, 'categories', id));
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
// SUBCATEGORIES
// ─────────────────────────────────────────────────────────────
export const SubcategoriesDB = {
  async getAll() {
    const snap = await getDocs(query(Refs.subcategories(), orderBy('nome')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async upsert(nome, data) {
    UserAccess.assert('editContent');
    const id = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await setDoc(doc(db, 'subcategories', id), {
      nome:    data.nome    || nome,
      formula: data.formula || '',
      ex:      data.ex      || '',
    });
  },

  async delete(nome) {
    UserAccess.assert('editContent');
    const id = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await deleteDoc(doc(db, 'subcategories', id));
  },

  listen(callback) {
    return onSnapshot(
      query(Refs.subcategories(), orderBy('nome')),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[SubcategoriesDB] Listener error:', err)
    );
  },

  async importBatch(rules) {
    UserAccess.assert('editContent');
    const batch = writeBatch(db);
    for (const rule of rules) {
      const id = rule.nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      batch.set(doc(db, 'subcategories', id), rule);
    }
    await batch.commit();
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
    await setDoc(doc(db, 'prompts', key), {
      key,
      value,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(key) {
    UserAccess.assert('editPrompts');
    await deleteDoc(doc(db, 'prompts', key));
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
    const snap = await getDocs(
      query(Refs.history(), orderBy('ts', 'desc'), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async save(data) {
    UserAccess.assert('editContent');
    const ref = await addDoc(Refs.history(), {
      preview:  data.preview  || '',
      ficha:    data.ficha    || '',
      conteudo: data.conteudo || '',
      bivolt:   !!data.bivolt,
      tokenUsage: data.tokenUsage || null,
      data:     new Date().toLocaleString('pt-BR'),
      ts:       serverTimestamp(),
    });
    return ref.id;
  },

  async updateResult(id, data) {
    UserAccess.assert('editContent');
    if (!id) return;
    await updateDoc(doc(db, 'history', id), {
      conteudo: data.conteudo || '',
      tokenUsage: data.tokenUsage || null,
      updatedAt: serverTimestamp(),
    });
  },

  async clearAll() {
    UserAccess.assert('editContent');
    const snap  = await getDocs(Refs.history());
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  listen(callback) {
    return onSnapshot(
      query(Refs.history(), orderBy('ts', 'desc'), limit(50)),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[HistoryDB] Listener error:', err)
    );
  },
};

export { db };
