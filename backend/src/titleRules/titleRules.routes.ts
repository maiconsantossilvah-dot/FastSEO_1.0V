import { Router } from 'express';
import type { AuthenticatedRequest } from '../auth/types.js';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import { AppError } from '../errors.js';
import { asyncRoute } from '../http/asyncRoute.js';
import { deleteTitleRule, importTitleRules, listTitleRules, upsertTitleRule } from './titleRules.service.js';
import { titleRuleIdSchema, titleRuleImportSchema, titleRuleSchema } from './titleRules.schema.js';
import { userMutationRateLimiter } from '../rateLimit.js';

function actor(req: AuthenticatedRequest) {
  if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
  return req.currentUser;
}

export const titleRulesRouter = Router();
titleRulesRouter.use(requireAuth, requireActiveUser);
titleRulesRouter.get('/title-rules', requireRole('useFastSeo'), asyncRoute(async (_req, res) => {
  res.json({ rules: await listTitleRules() });
}));
titleRulesRouter.put('/title-rules/:id', requireRole('manageCategoryCatalog'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const { id } = titleRuleIdSchema.parse(req.params);
  const input = titleRuleSchema.parse(req.body);
  res.json({ rule: await upsertTitleRule(actor(req), id, input) });
}));
titleRulesRouter.delete('/title-rules/:id', requireRole('manageCategoryCatalog'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const { id } = titleRuleIdSchema.parse(req.params);
  res.json(await deleteTitleRule(actor(req), id));
}));
titleRulesRouter.post('/title-rules/import', requireRole('manageCategoryCatalog'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const input = titleRuleImportSchema.parse(req.body);
  res.json(await importTitleRules(actor(req), input.rules, input.replace));
}));
