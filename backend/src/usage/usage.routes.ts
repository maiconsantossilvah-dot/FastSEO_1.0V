import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import type { AuthenticatedRequest } from '../auth/types.js';
import { AppError } from '../errors.js';
import { asyncRoute } from '../http/asyncRoute.js';
import { usageAnalyticsQuerySchema, usageEventSchema } from './usage.schema.js';
import { getUsageAnalytics, recordUsageEvent } from './usage.service.js';
import { userMutationRateLimiter } from '../rateLimit.js';

function actor(req: AuthenticatedRequest) {
  if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
  return req.currentUser;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export const usageRouter = Router();
usageRouter.use(requireAuth, requireActiveUser);

usageRouter.post('/usage-events', requireRole('useFastSeo'), userMutationRateLimiter, asyncRoute(async (req, res) => {
  const event = usageEventSchema.parse(req.body);
  res.status(202).json(await recordUsageEvent(actor(req), event));
}));

usageRouter.get('/usage-analytics', requireRole('viewUsageAnalytics'), asyncRoute(async (req, res) => {
  const defaults = defaultRange();
  const range = usageAnalyticsQuerySchema.parse({
    from: req.query.from || defaults.from,
    to: req.query.to || defaults.to,
  });
  res.json(await getUsageAnalytics(range));
}));
