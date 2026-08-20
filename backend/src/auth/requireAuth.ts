import type { NextFunction, Response } from 'express';
import { adminAuth, adminDb } from '../firebaseAdmin.js';
import { AppError } from '../errors.js';
import type { UserDocument } from '../users/types.js';
import type { AuthenticatedRequest } from './types.js';

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match?.[1]) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Token de autenticação ausente.');
    }

    req.firebaseUser = await adminAuth.verifyIdToken(match[1]);
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError(401, 'INVALID_TOKEN', 'Token de autenticação inválido ou expirado.'));
  }
}

export async function requireActiveUser(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const uid = req.firebaseUser?.uid;
    if (!uid) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');

    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) throw new AppError(403, 'ACCESS_NOT_REQUESTED', 'Solicitação de acesso não encontrada.');

    const user = snap.data() as UserDocument;
    if (user.status !== 'active' || !user.role) {
      throw new AppError(403, 'USER_NOT_ACTIVE', 'O usuário não está ativo.');
    }

    req.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}
