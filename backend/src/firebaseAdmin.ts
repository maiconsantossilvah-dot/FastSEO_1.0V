import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, statSync } from 'node:fs';
import { config } from './config.js';
import { normalizePrivateKey } from './credentials.js';

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
const applicationCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

if (Boolean(clientEmail) !== Boolean(privateKey)) {
  throw new Error('FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY devem ser definidos juntos.');
}

if (config.isProduction && (!clientEmail || !privateKey)) {
  throw new Error('FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY são obrigatórios em produção.');
}

if (config.environment !== 'test' && !clientEmail && applicationCredentialsPath) {
  let validFile = false;
  try {
    validFile = existsSync(applicationCredentialsPath) && statSync(applicationCredentialsPath).isFile();
  } catch {
    validFile = false;
  }
  if (!validFile) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS aponta para um arquivo inexistente. Atualize o caminho em backend/.env.');
  }
}

const credential = clientEmail && privateKey
  ? cert({ projectId: config.firebaseProjectId, clientEmail, privateKey })
  : applicationDefault();

const app = getApps()[0] || initializeApp({
  credential,
  projectId: config.firebaseProjectId,
});

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
