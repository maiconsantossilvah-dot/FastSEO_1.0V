import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import type { AuthenticatedRequest } from '../auth/types.js';
import { pipelineComposeSchema, pipelinePrepareSchema } from './pipeline.schema.js';
import { composeProduct, prepareProduct } from './pipeline.service.js';

const asyncRoute = (handler: (req: AuthenticatedRequest, res: any) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: any, next: any) => Promise.resolve(handler(req, res)).catch(next);

export const pipelineRouter = Router();
pipelineRouter.use(requireAuth, requireActiveUser);

pipelineRouter.post('/pipeline/prepare', requireRole('useFastSeo'), asyncRoute(async (req, res) => {
  res.json(await prepareProduct(pipelinePrepareSchema.parse(req.body)));
}));

pipelineRouter.post('/pipeline/compose', requireRole('useFastSeo'), asyncRoute(async (req, res) => {
  res.json(await composeProduct(pipelineComposeSchema.parse(req.body)));
}));
