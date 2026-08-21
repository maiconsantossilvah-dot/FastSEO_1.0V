import { AppError } from '../errors.js';
import type { UserDocument, UserRole } from '../users/types.js';

export type Permission =
  | 'useFastSeo'
  | 'editContent'
  | 'viewUsers'
  | 'manageUsers'
  | 'viewPrompts'
  | 'editPrompts'
  | 'approveAccess'
  | 'manageRoles'
  | 'manageCategoryCatalog';

type PermissionSet = Readonly<Record<Permission, boolean>>;

const viewer: PermissionSet = Object.freeze({
  useFastSeo: true,
  editContent: false,
  viewUsers: false,
  manageUsers: false,
  viewPrompts: false,
  editPrompts: false,
  approveAccess: false,
  manageRoles: false,
  manageCategoryCatalog: false,
});

const collaborator: PermissionSet = Object.freeze({
  ...viewer,
  editContent: true,
});

const admin: PermissionSet = Object.freeze({
  ...collaborator,
  viewUsers: true,
  manageUsers: true,
  viewPrompts: true,
  editPrompts: true,
  approveAccess: true,
  manageRoles: true,
  manageCategoryCatalog: true,
});

export const PERMISSIONS: Readonly<Record<UserRole, PermissionSet>> = Object.freeze({
  owner: admin,
  admin,
  collaborator,
  viewer,
});

export function permissionsFor(role: UserRole | null): PermissionSet | null {
  return role ? PERMISSIONS[role] : null;
}

export function requirePermission(user: UserDocument, permission: Permission): void {
  if (!user.role || !PERMISSIONS[user.role][permission]) {
    throw new AppError(403, 'FORBIDDEN', 'Você não tem permissão para esta ação.');
  }
}

export type UserAction = 'approve' | 'reject' | 'changeRole' | 'suspend' | 'reactivate';

export function assertTargetAllowed(
  actor: UserDocument,
  target: UserDocument,
  action: UserAction,
  nextRole?: UserRole,
): void {
  requirePermission(actor, action === 'approve' || action === 'reject' ? 'approveAccess' : 'manageUsers');

  if (actor.role === 'owner') return;

  if (actor.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Você não pode administrar usuários.');
  }

  if (action === 'approve' || action === 'reject') {
    if (target.status === 'pending' && target.role === null) return;
  } else if (target.role === 'viewer' || target.role === 'collaborator') {
    if (action !== 'changeRole' || nextRole === 'viewer' || nextRole === 'collaborator') return;
  }

  throw new AppError(403, 'TARGET_NOT_MANAGEABLE', 'Administradores só podem gerenciar colaboradores e espectadores.');
}

export function assertOwnerContinuity(target: UserDocument, activeOwnerCount: number): void {
  if (target.role === 'owner' && target.status === 'active' && activeOwnerCount <= 1) {
    throw new AppError(409, 'LAST_OWNER', 'O último proprietário ativo não pode ser rebaixado ou suspenso.');
  }
}
