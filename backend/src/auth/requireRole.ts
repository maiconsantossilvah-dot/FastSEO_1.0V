import type { NextFunction, Response } from 'express';
import { AppError } from '../errors.js';
import type { AuthenticatedRequest } from './types.js';
import { requirePermission, type Permission } from './permissions.js';

export function requireRole(permission: Permission) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
      requirePermission(req.currentUser, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}
