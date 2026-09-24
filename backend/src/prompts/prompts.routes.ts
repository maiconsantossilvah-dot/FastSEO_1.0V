import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import type { AuthenticatedRequest } from '../auth/types.js';
import { AppError } from '../errors.js';
import { asyncRoute } from '../http/asyncRoute.js';
import { userMutationRateLimiter } from '../rateLimit.js';
import { promptKeySchema, promptUpdateSchema } from './prompts.schema.js';
import { deletePrompt, updatePrompt } from './prompts.service.js';

function actor(req: AuthenticatedRequest) {
  if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
  return req.currentUser;
}

export const promptsRouter = Router();

promptsRouter.put('/prompts/:key', requireAuth, requireActiveUser, requireRole('editPrompts'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const { key } = promptKeySchema.parse(req.params);
  const { value } = promptUpdateSchema.parse(req.body);
  res.json(await updatePrompt(actor(req), key, value));
}));

promptsRouter.delete('/prompts/:key', requireAuth, requireActiveUser, requireRole('editPrompts'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const { key } = promptKeySchema.parse(req.params);
  res.json(await deletePrompt(actor(req), key));
}));
