import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './config.js';
import { normalizePrivateKey } from './credentials.js';

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (Boolean(clientEmail) !== Boolean(privateKey)) {
  throw new Error('FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY devem ser definidos juntos.');
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
