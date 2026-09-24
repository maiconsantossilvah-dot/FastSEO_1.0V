import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import type { AuthenticatedRequest } from '../auth/types.js';
import { AppError } from '../errors.js';
import { asyncRoute } from '../http/asyncRoute.js';
import { userMutationRateLimiter } from '../rateLimit.js';
import { historyCreateSchema, historyIdSchema, historyUpdateSchema } from './history.schema.js';
import { clearHistory, createHistoryItem, updateHistoryItem } from './history.service.js';

function actor(req: AuthenticatedRequest) {
  if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
  return req.currentUser;
}

export const historyRouter = Router();

historyRouter.post('/history', requireAuth, requireActiveUser, requireRole('editContent'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const input = historyCreateSchema.parse(req.body);
  res.status(201).json(await createHistoryItem(actor(req), input));
}));

historyRouter.patch('/history/:id', requireAuth, requireActiveUser, requireRole('editContent'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const { id } = historyIdSchema.parse(req.params);
  const input = historyUpdateSchema.parse(req.body);
  res.json(await updateHistoryItem(actor(req), id, input));
}));

historyRouter.delete('/history', requireAuth, requireActiveUser, requireRole('editContent'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  res.json(await clearHistory(actor(req)));
}));
