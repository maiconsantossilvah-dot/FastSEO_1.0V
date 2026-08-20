export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB7N4AXfSIia5dm_M8_bIx8w01MHy5JgFk",
  authDomain:        "fastseo-6a61b.firebaseapp.com",
  projectId:         "fastseo-6a61b",
  storageBucket:     "fastseo-6a61b.firebasestorage.app",
  messagingSenderId: "460968097608",
  appId:             "1:460968097608:web:48b103fc710bd98bff657d",
  measurementId: "G-5QMCX3H979"
};
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const MISTRAL_MODEL = "mistral-medium-latest";
export const APP_CONFIG = {
  historyMaxItems: 50,
  logsMaxItems:    300,
  inputMaxChars:   12000,
  autoSaveDelay:   700,
  toastDuration:   2000,
  usersApiBaseUrl: globalThis.FASTSEO_BACKEND_URL
    || (/^(localhost|127\.0\.0\.1)$/.test(globalThis.location?.hostname || '')
      ? 'http://localhost:8787/api'
      : '/api'),
};
