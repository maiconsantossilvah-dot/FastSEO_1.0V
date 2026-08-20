import { Router } from 'express';
import { z } from 'zod';
import { requireActiveUser, requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import type { AuthenticatedRequest } from '../auth/types.js';
import { AppError } from '../errors.js';
import { USER_ROLES } from './types.js';
import {
  approveUser,
  changeUserRole,
  getMe,
  listUsers,
  reactivateUser,
  rejectUser,
  requestAccess,
  suspendUser,
} from './users.service.js';

const targetSchema = z.object({ uid: z.string().trim().min(1).max(128) });
const roleSchema = z.object({ role: z.enum(USER_ROLES) });
const asyncRoute = (handler: (req: AuthenticatedRequest, res: any) => Promise<unknown>) =>
  (req: AuthenticatedRequest, res: any, next: any) => Promise.resolve(handler(req, res)).catch(next);

function actor(req: AuthenticatedRequest) {
  if (!req.currentUser) throw new AppError(401, 'AUTH_REQUIRED', 'Usuário não autenticado.');
  return req.currentUser;
}

export const usersRouter = Router();

usersRouter.post('/access-requests', requireAuth, asyncRoute(async (req, res) => {
  res.status(200).json(await requestAccess(req.firebaseUser!));
}));

usersRouter.get('/me', requireAuth, asyncRoute(async (req, res) => {
  res.json(await getMe(req.firebaseUser!.uid));
}));

usersRouter.get('/users', requireAuth, requireActiveUser, requireRole('viewUsers'), asyncRoute(async (_req, res) => {
  res.json({ users: await listUsers() });
}));

usersRouter.post('/users/:uid/approve', requireAuth, requireActiveUser, requireRole('approveAccess'), asyncRoute(async (req, res) => {
  const { uid } = targetSchema.parse(req.params);
  res.json({ user: await approveUser(actor(req), uid) });
}));

usersRouter.post('/users/:uid/reject', requireAuth, requireActiveUser, requireRole('approveAccess'), asyncRoute(async (req, res) => {
  const { uid } = targetSchema.parse(req.params);
  res.json({ user: await rejectUser(actor(req), uid) });
}));

usersRouter.patch('/users/:uid/role', requireAuth, requireActiveUser, requireRole('manageRoles'), asyncRoute(async (req, res) => {
  const { uid } = targetSchema.parse(req.params);
  const { role } = roleSchema.parse(req.body);
  res.json({ user: await changeUserRole(actor(req), uid, role) });
}));

usersRouter.post('/users/:uid/suspend', requireAuth, requireActiveUser, requireRole('manageUsers'), asyncRoute(async (req, res) => {
  const { uid } = targetSchema.parse(req.params);
  res.json({ user: await suspendUser(actor(req), uid) });
}));

usersRouter.post('/users/:uid/reactivate', requireAuth, requireActiveUser, requireRole('manageUsers'), asyncRoute(async (req, res) => {
  const { uid } = targetSchema.parse(req.params);
  res.json({ user: await reactivateUser(actor(req), uid) });
}));
