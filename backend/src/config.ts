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

function origins(value: string | undefined): string[] {
  return list(value).map(item => {
    try {
      const url = new URL(item);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      return url.origin;
    } catch {
      throw new Error(`Origem inválida em FRONTEND_ORIGINS: ${item}`);
    }
  });
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} deve ser um número inteiro positivo.`);
  }
  return parsed;
}

function enabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());
}

const port = positiveInteger(process.env.PORT, 8787, 'PORT');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT deve ser um número entre 1 e 65535.');
}

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';
const frontendOrigins = origins(process.env.FRONTEND_ORIGINS);
const bootstrapOwnerEmails = new Set(
  list(process.env.BOOTSTRAP_OWNER_EMAILS).map(email => email.toLocaleLowerCase('pt-BR')),
);
const allowProductionBootstrap = enabled(process.env.ALLOW_PRODUCTION_BOOTSTRAP);

if (isProduction && frontendOrigins.length === 0) {
  throw new Error('FRONTEND_ORIGINS é obrigatório em produção.');
}

if (isProduction && bootstrapOwnerEmails.size > 0 && !allowProductionBootstrap) {
  throw new Error('Para o bootstrap inicial em produção, defina ALLOW_PRODUCTION_BOOTSTRAP=true temporariamente.');
}

export const config = Object.freeze({
  port,
  host: process.env.HOST || '0.0.0.0',
  environment,
  isProduction,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'fastseo-6a61b',
  frontendOrigins,
  bootstrapOwnerEmails,
  allowProductionBootstrap,
  rateLimitWindowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 'RATE_LIMIT_WINDOW_MS'),
  rateLimitMax: positiveInteger(process.env.RATE_LIMIT_MAX, 120, 'RATE_LIMIT_MAX'),
  userRateLimitMax: positiveInteger(process.env.USER_RATE_LIMIT_MAX, 120, 'USER_RATE_LIMIT_MAX'),
});
