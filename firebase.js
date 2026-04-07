/**
 * firebase.js
 * ───────────
 * Inicializa o Firebase UMA única vez e exporta as instâncias
 * para todos os módulos do projeto (auth.js, firestore.js, etc).
 *
 * NUNCA chame initializeApp() em outro arquivo — importe daqui.
 */

import { FIREBASE_CONFIG } from './config.js';

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp(FIREBASE_CONFIG);

export const db   = getFirestore(app);
export const auth = getAuth(app);
