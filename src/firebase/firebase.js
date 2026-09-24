/**
 * firebase.js
 * ───────────
 * Inicializa o Firebase UMA única vez e exporta as instâncias
 * para todos os módulos do projeto (auth.js, firestore.js, etc).
 *
 * NUNCA chame initializeApp() em outro arquivo — importe daqui.
 */

import { APP_CONFIG, FIREBASE_CONFIG } from '../config.js';

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  ReCaptchaEnterpriseProvider,
  getToken,
  initializeAppCheck,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp(FIREBASE_CONFIG);
const appCheck = APP_CONFIG.appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(APP_CONFIG.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

export const db   = getFirestore(app);
export const auth = getAuth(app);

export async function getAppCheckToken() {
  if (!appCheck) return '';
  try {
    return (await getToken(appCheck)).token;
  } catch (error) {
    console.warn('[AppCheck] Não foi possível obter a prova de origem.', error);
    return '';
  }
}
