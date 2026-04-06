/**
 * firebase/firestore.js
 * ─────────────────────
 * Inicializa Firebase e expõe CRUD + listeners em tempo real
 * para as coleções: categories, subcategories, prompts, history
 *
 * Estrutura Firestore:
 *   /categories/{docId}       → { id, nome, campos, ficha, copy, updatedAt }
 *   /subcategories/{docId}    → { nome, formula, ex }
 *   /prompts/{docId}          → { key, value, updatedAt }   key = P1,P2,P3,P1B…
 *   /history/{docId}          → { preview, ficha, conteudo, bivolt, data, ts }
 */

import { FIREBASE_CONFIG } from './config.js';

import { initializeApp }            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
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

// ── Init ─────────────────────────────────────────────────────
const app = initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

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
  /**
   * Retorna todas as categorias ordenadas por nome.
   * (leitura única — use listenCategories para tempo real)
   */
  async getAll() {
    const snap = await getDocs(query(Refs.categories(), orderBy('nome')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /** Cria nova categoria e retorna o documento criado */
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

  /** Atualiza campos de uma categoria existente */
  async update(id, data) {
    await updateDoc(doc(db, 'categories', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /** Remove uma categoria */
  async delete(id) {
    await deleteDoc(doc(db, 'categories', id));
  },

  /**
   * 🔴 Listener em tempo real — chame na inicialização do app.
   * callback(categories[]) é chamado toda vez que o Firestore muda.
   * Retorna a função unsubscribe.
   *
   * Exemplo:
   *   const unsub = CategoriesDB.listen(cats => SidebarUI.render(cats));
   *   // Para parar: unsub();
   */
  listen(callback) {
    return onSnapshot(
      query(Refs.categories(), orderBy('nome')),
      snap => {
        const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(cats);
      },
      err => console.error('[CategoriesDB] Listener error:', err)
    );
  },
};

// ─────────────────────────────────────────────────────────────
// SUBCATEGORIES
// ─────────────────────────────────────────────────────────────
export const SubcategoriesDB = {
  /** Retorna todas as subcategorias */
  async getAll() {
    const snap = await getDocs(query(Refs.subcategories(), orderBy('nome')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /** Cria ou substitui uma subcategoria pelo nome (upsert) */
  async upsert(nome, data) {
    // Usa o nome normalizado como ID para garantir unicidade
    const id  = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await setDoc(doc(db, 'subcategories', id), {
      nome:    data.nome    || nome,
      formula: data.formula || '',
      ex:      data.ex      || '',
    });
  },

  /** Remove uma subcategoria pelo nome */
  async delete(nome) {
    const id = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    await deleteDoc(doc(db, 'subcategories', id));
  },

  /** 🔴 Listener em tempo real */
  listen(callback) {
    return onSnapshot(
      query(Refs.subcategories(), orderBy('nome')),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[SubcategoriesDB] Listener error:', err)
    );
  },

  /** Importa lista em lote (migration de localStorage) */
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
  /** Retorna todos os prompts customizados como objeto { key: value } */
  async getAll() {
    const snap = await getDocs(Refs.prompts());
    const obj = {};
    snap.docs.forEach(d => { obj[d.id] = d.data().value; });
    return obj;
  },

  /** Salva (cria ou sobrescreve) um prompt customizado */
  async save(key, value) {
    await setDoc(doc(db, 'prompts', key), {
      key,
      value,
      updatedAt: serverTimestamp(),
    });
  },

  /** Remove um prompt (volta para o padrão) */
  async delete(key) {
    await deleteDoc(doc(db, 'prompts', key));
  },

  /** 🔴 Listener em tempo real */
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
  /** Retorna os últimos N registros do histórico */
  async getRecent(n = 50) {
    const snap = await getDocs(
      query(Refs.history(), orderBy('ts', 'desc'), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /** Salva um novo item no histórico */
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

  /** Remove todos os itens do histórico */
  async clearAll() {
    const snap = await getDocs(Refs.history());
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  /** 🔴 Listener em tempo real — recebe novos itens conforme são inseridos */
  listen(callback) {
    return onSnapshot(
      query(Refs.history(), orderBy('ts', 'desc'), limit(50)),
      snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[HistoryDB] Listener error:', err)
    );
  },
};

export { db };
