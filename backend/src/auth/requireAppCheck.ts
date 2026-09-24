import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { adminAppCheck } from '../firebaseAdmin.js';

function logRejectedToken(req: Request, reason: 'missing' | 'invalid') {
  console.warn(JSON.stringify({
    level: 'warn',
    event: 'app_check_rejected',
    enforcement: config.appCheckEnforcement,
    reason,
    method: req.method,
    path: req.path,
  }));
}

/**
 * Valida a prova de origem do Firebase App Check para o backend inteiro.
 * Enquanto APP_CHECK_ENFORCEMENT=false, funciona em modo de monitoramento:
 * tokens válidos são verificados e ausências/falhas não interrompem o tráfego.
 */
export async function requireAppCheck(req: Request, _res: Response, next: NextFunction) {
  const token = req.get('x-firebase-appcheck')?.trim();
  if (!token) {
    if (!config.appCheckEnforcement) return next();
    logRejectedToken(req, 'missing');
    return next(new AppError(401, 'APP_CHECK_REQUIRED', 'Prova de origem do aplicativo ausente. Atualize a página e tente novamente.'));
  }

  try {
    await adminAppCheck.verifyToken(token);
    return next();
  } catch {
    logRejectedToken(req, 'invalid');
    if (!config.appCheckEnforcement) return next();
    return next(new AppError(401, 'INVALID_APP_CHECK', 'Prova de origem do aplicativo inválida ou expirada.'));
  }
}
