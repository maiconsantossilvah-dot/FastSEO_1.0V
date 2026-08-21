import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import type { AuthenticatedRequest } from '../auth/types.js';
import { AppError } from '../errors.js';
import {
  categoryIdSchema,
  categoryImportSchema,
  categoryProfileInputSchema,
  categoryProfilePatchSchema,
  categoryResolveSchema,
} from './categories.schema.js';
import {
  archiveProfile,
  commitImport,
  commitLegacyMigration,
  createProfile,
  exportCategoryBackup,
  getPublishedCatalog,
  listWorkingProfiles,
  previewImport,
  previewLegacyMigration,
  publishProfile,
  resolvePublishedCategory,
  updateProfile,
} from './categories.service.js';
import { slugifyCategory } from './legacyMigration.js';
import type { CategoryProfile } from './types.js';

const asyncRoute = (handler: (req: AuthenticatedRequest, res: any) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: any, next: any) => Promise.resolve(handler(req, res)).catch(next);

function actor(req: AuthenticatedRequest) {
  if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
  return req.currentUser;
}

function importProfiles(body: unknown): CategoryProfile[] {
  const parsed = categoryImportSchema.parse(body);
  return parsed.profiles.map(profile => ({
    ...profile,
    id: profile.id || slugifyCategory(profile.name),
    status: 'draft',
    revision: 1,
  }));
}

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth, requireActiveUser);

categoriesRouter.get('/category-catalog', requireRole('useFastSeo'), asyncRoute(async (_req, res) => {
  res.json(await getPublishedCatalog());
}));

categoriesRouter.post('/category-resolve', requireRole('useFastSeo'), asyncRoute(async (req, res) => {
  const { input } = categoryResolveSchema.parse(req.body);
  res.json(await resolvePublishedCategory(input));
}));

categoriesRouter.get('/category-profiles', requireRole('manageCategoryCatalog'), asyncRoute(async (_req, res) => {
  res.json(await listWorkingProfiles());
}));

categoriesRouter.get('/category-profiles/export', requireRole('manageCategoryCatalog'), asyncRoute(async (_req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="fastseo-categorias-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(await exportCategoryBackup());
}));

categoriesRouter.post('/category-profiles/import/preview', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  res.json(await previewImport(importProfiles(req.body)));
}));

categoriesRouter.post('/category-profiles/import/commit', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  res.status(201).json(await commitImport(actor(req), importProfiles(req.body)));
}));

categoriesRouter.post('/category-profiles/migrate-legacy/preview', requireRole('manageCategoryCatalog'), asyncRoute(async (_req, res) => {
  res.json(await previewLegacyMigration());
}));

categoriesRouter.post('/category-profiles/migrate-legacy/commit', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  res.status(201).json(await commitLegacyMigration(actor(req)));
}));

categoriesRouter.post('/category-profiles', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  const input = categoryProfileInputSchema.parse(req.body);
  res.status(201).json({ profile: await createProfile(actor(req), input as any) });
}));

categoriesRouter.patch('/category-profiles/:id', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  const { id } = categoryIdSchema.parse(req.params);
  const changes = categoryProfilePatchSchema.parse(req.body);
  res.json({ profile: await updateProfile(actor(req), id, changes as any) });
}));

categoriesRouter.post('/category-profiles/:id/publish', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  const { id } = categoryIdSchema.parse(req.params);
  res.json(await publishProfile(actor(req), id));
}));

categoriesRouter.delete('/category-profiles/:id', requireRole('manageCategoryCatalog'), asyncRoute(async (req, res) => {
  const { id } = categoryIdSchema.parse(req.params);
  res.json(await archiveProfile(actor(req), id));
}));
