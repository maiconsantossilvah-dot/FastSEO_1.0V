/**
 * auth.js
 * ───────
 * Autenticação Google. A autorização é validada no backend de usuários,
 * que verifica o Firebase ID Token e consulta users/{uid} no Firestore.
 *
 * Importa auth do firebase.js central — não inicializa de novo.
 */

import { auth } from '../firebase/firebase.js';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const provider = new GoogleAuthProvider();

// ─────────────────────────────────────────────────────────────
export const Auth = {
  /**
   * Abre popup de login com Google.
   * A autorização acontece depois, no observador de sessão, para que uma
   * primeira entrada possa criar uma solicitação pendente no backend.
   */
  async login() {
    const result = await signInWithPopup(auth, provider);
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
