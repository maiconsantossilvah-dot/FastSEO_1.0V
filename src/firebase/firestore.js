/**
 * firebase/firestore.js
 * ─────────────────────
 * Expõe leitura do legado e persistência das coleções ainda mantidas no cliente.
 * Categorias e regras de título são alteradas exclusivamente pelo backend.
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
    const history = Refs.history(currentUid());
    const snap = await getDocs(
      query(history, orderBy('ts', 'desc'), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async save(data) {
    UserAccess.assert('editContent');
    const ref = await addDoc(Refs.history(currentUid()), {
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
    await updateDoc(doc(db, 'users', currentUid(), 'history', id), {
      conteudo: data.conteudo || '',
      tokenUsage: data.tokenUsage || null,
      updatedAt: serverTimestamp(),
    });
  },

  async clearAll() {
    UserAccess.assert('editContent');
    const history = Refs.history(currentUid());
    // Firestore limita batches a 500 operações. O laço mantém a exclusão segura
    // mesmo quando um usuário acumular um histórico maior no futuro.
    while (true) {
      const snap = await getDocs(query(history, limit(400)));
      if (snap.empty) break;
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
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
