import { loadEnvFile } from 'node:process';

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

function list(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT deve ser um número entre 1 e 65535.');
}

export const config = Object.freeze({
  port,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'fastseo-6a61b',
  frontendOrigins: list(process.env.FRONTEND_ORIGINS),
  bootstrapOwnerEmails: new Set(
    list(process.env.BOOTSTRAP_OWNER_EMAILS).map(email => email.toLocaleLowerCase('pt-BR')),
  ),
});
