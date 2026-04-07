/**
 * auth.js
 * ───────
 * Autenticação Google com validação de acesso via Firestore.
 * Para autorizar um usuário: adicione o e-mail dele como ID de documento
 * na coleção "usuarios_autorizados" no painel do Firebase.
 * Nenhuma lista de e-mails fica no código.
 *
 * Importa auth e db do firebase.js central — não inicializa de novo.
 */

import { auth, db } from './firebase.js';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const provider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────────
export const Auth = {
  /**
   * Abre popup de login com Google.
   * Verifica se o e-mail está na coleção "usuarios_autorizados".
   * Se não estiver, desloga e lança erro.
   */
  async login() {
    const result = await signInWithPopup(auth, provider);
    const email  = result.user.email;

    // Consulta o Firestore — o documento é o próprio e-mail
    const ref  = doc(db, 'usuarios_autorizados', email);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await signOut(auth);
      throw new Error(`Acesso negado para ${email}. Entre em contato com o administrador.`);
    }

    return result.user;
  },

  /** Desloga o usuário atual */
  async logout() {
    await signOut(auth);
  },

  /** Retorna o usuário atual (ou null se não logado) */
  currentUser() {
    return auth.currentUser;
  },

  /**
   * Observa mudanças de estado de autenticação.
   * Retorna a função unsubscribe.
   */
  onChange(callback) {
    return onAuthStateChanged(auth, callback);
  },
};
