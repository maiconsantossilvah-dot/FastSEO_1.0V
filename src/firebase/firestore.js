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
 *   /history/{docId}          → { preview, ficha, conteudo, bivolt, data, ts }
 */

import { db } from './firebase.js';

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

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────
export const CategoriesDB = {
  async getAll() {
    const snap = await getDocs(query(Refs.categories(), orderBy('nome')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async create(data) {
    const ref = await addDoc(Refs.categories(), {
      nome:      data.nome   || 'Nova Categoria',
      campos:    data.campos || '',
      ficha:     data.ficha  || '',
      copy:      data.copy   || '',
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...data };
  },

  async update(id, data) {
    await updateDoc(doc(db, 'categories', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id) {
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
    const id = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await setDoc(doc(db, 'subcategories', id), {
      nome:    data.nome    || nome,
      formula: data.formula || '',
      ex:      data.ex      || '',
    });
  },

  async delete(nome) {
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
    await setDoc(doc(db, 'prompts', key), {
      key,
      value,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(key) {
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
    await addDoc(Refs.history(), {
      preview:  data.preview  || '',
      ficha:    data.ficha    || '',
      conteudo: data.conteudo || '',
      bivolt:   !!data.bivolt,
      data:     new Date().toLocaleString('pt-BR'),
      ts:       serverTimestamp(),
    });
  },

  async clearAll() {
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
