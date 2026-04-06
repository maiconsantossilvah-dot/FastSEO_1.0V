/**
 * ╔══════════════════════════════════════════════════╗
 * ║  FastSEO — Configurações Centralizadas           ║
 * ╠══════════════════════════════════════════════════╣
 * ║  ⚠️  ATENÇÃO — SEGURANÇA DAS API KEYS            ║
 * ║                                                  ║
 * ║  As chaves abaixo ficam expostas no navegador.   ║
 * ║  Qualquer pessoa com devtools pode vê-las.       ║
 * ║                                                  ║
 * ║  MITIGAÇÕES APLICADAS:                           ║
 * ║  • Keys são inseridas pelo usuário (não hardcode)║
 * ║  • Firebase usa Security Rules para controle     ║
 * ║  • Gemini/Mistral têm cotas próprias por chave  ║
 * ║                                                  ║
 * ║  SOLUÇÃO FUTURA RECOMENDADA:                     ║
 * ║  Mover chamadas de API para Cloud Functions ou   ║
 * ║  um proxy serverless (ex: Vercel/Netlify Funcs)  ║
 * ║  para nunca expor keys no frontend.              ║
 * ╚══════════════════════════════════════════════════╝
 */

// ─── Firebase ───────────────────────────────────────────────
// Substitua pelos valores do seu projeto no Firebase Console:
// https://console.firebase.google.com → Projeto → Configurações → Seus apps
export const FIREBASE_CONFIG = {
  apiKey:            "YOUR_FIREBASE_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// ─── Gemini ─────────────────────────────────────────────────
// Chave obtida em: https://aistudio.google.com/app/apikey
// A chave também pode ser inserida pelo usuário na interface.
export const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";

// ─── Mistral ────────────────────────────────────────────────
// Chave obtida em: https://console.mistral.ai
export const MISTRAL_MODEL = "mistral-small-latest";

// ─── App ────────────────────────────────────────────────────
export const APP_CONFIG = {
  historyMaxItems:  50,
  logsMaxItems:     300,
  inputMaxChars:    12000,
  autoSaveDelay:    700,   // ms
  toastDuration:    2000,  // ms
};
