import type { DecodedIdToken } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { assertOwnerContinuity, assertTargetAllowed, permissionsFor } from '../auth/permissions.js';
import { createAuditLog, type AuditAction } from '../audit/createAuditLog.js';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { adminDb } from '../firebaseAdmin.js';
import type { UserDocument, UserRole } from './types.js';

function publicUser(user: UserDocument) {
  return {
    ...user,
    createdAt: user.createdAt?.toDate?.().toISOString?.() || null,
    approvedAt: user.approvedAt?.toDate?.().toISOString?.() || null,
  };
}

function ensureState(user: UserDocument, expected: UserDocument['status'], action: string): void {
  if (user.status !== expected) {
    throw new AppError(409, 'INVALID_USER_STATE', `Somente usuários ${expected} podem ser ${action}.`);
  }
}

async function ensureOwnerRemains(transaction: FirebaseFirestore.Transaction, target: UserDocument): Promise<void> {
  if (target.role !== 'owner' || target.status !== 'active') return;
  const owners = await transaction.get(
    adminDb.collection('users').where('role', '==', 'owner').where('status', '==', 'active'),
  );
  assertOwnerContinuity(target, owners.size);
}

export async function requestAccess(token: DecodedIdToken) {
  const ref = adminDb.collection('users').doc(token.uid);
  const email = String(token.email || '').trim().toLocaleLowerCase('pt-BR');
  if (!email) throw new AppError(400, 'EMAIL_REQUIRED', 'A conta autenticada não possui e-mail.');

  const user = await adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (snap.exists) return snap.data() as UserDocument;

    const isBootstrapOwner = config.bootstrapOwnerEmails.has(email);
    const now = Timestamp.now();
    const created: UserDocument = {
      uid: token.uid,
      email,
      displayName: String(token.name || email),
      role: isBootstrapOwner ? 'owner' : null,
      status: isBootstrapOwner ? 'active' : 'pending',
      createdAt: now,
      approvedAt: isBootstrapOwner ? now : null,
      approvedBy: isBootstrapOwner ? 'SYSTEM_BOOTSTRAP' : null,
    };
    transaction.create(ref, created);
    return created;
  });

  return { user: publicUser(user), permissions: user.status === 'active' ? permissionsFor(user.role) : null };
}

export async function getMe(uid: string) {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new AppError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
  const user = snap.data() as UserDocument;
  return { user: publicUser(user), permissions: user.status === 'active' ? permissionsFor(user.role) : null };
}

export async function listUsers() {
  const snap = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
  return snap.docs.map(doc => publicUser(doc.data() as UserDocument));
}

async function mutateUser(
  actor: UserDocument,
  targetUid: string,
  action: Parameters<typeof assertTargetAllowed>[2],
  auditAction: AuditAction,
  mutate: (target: UserDocument) => Partial<UserDocument>,
  nextRole?: UserRole,
) {
  if (!targetUid) throw new AppError(400, 'TARGET_REQUIRED', 'Usuário alvo não informado.');
  const ref = adminDb.collection('users').doc(targetUid);

  const updated = await adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new AppError(404, 'USER_NOT_FOUND', 'Usuário alvo não encontrado.');
    const target = snap.data() as UserDocument;
    assertTargetAllowed(actor, target, action, nextRole);

    if ((action === 'changeRole' && target.role === 'owner' && nextRole !== 'owner') || action === 'suspend') {
      await ensureOwnerRemains(transaction, target);
    }

    const changes = mutate(target);
    const next = { ...target, ...changes } as UserDocument;
    transaction.update(ref, changes);
    createAuditLog(transaction, {
      actorUid: actor.uid,
      action: auditAction,
      targetUid,
      previousValue: { role: target.role, status: target.status },
      newValue: { role: next.role, status: next.status },
    });
    return next;
  });

  return publicUser(updated);
}

export function approveUser(actor: UserDocument, targetUid: string) {
  return mutateUser(actor, targetUid, 'approve', 'USER_APPROVED', target => {
    ensureState(target, 'pending', 'aprovados');
    return {
      status: 'active',
      role: 'viewer',
      approvedAt: Timestamp.now(),
      approvedBy: actor.uid,
    };
  });
}

export function rejectUser(actor: UserDocument, targetUid: string) {
  return mutateUser(actor, targetUid, 'reject', 'USER_REJECTED', target => {
    ensureState(target, 'pending', 'rejeitados');
    return { status: 'rejected', role: null, approvedAt: null, approvedBy: null };
  });
}

export function changeUserRole(actor: UserDocument, targetUid: string, role: UserRole) {
  return mutateUser(actor, targetUid, 'changeRole', 'USER_ROLE_CHANGED', target => {
    ensureState(target, 'active', 'alterados');
    if (target.role === role) throw new AppError(409, 'ROLE_UNCHANGED', 'O usuário já possui esse cargo.');
    return { role };
  }, role);
}

export function suspendUser(actor: UserDocument, targetUid: string) {
  return mutateUser(actor, targetUid, 'suspend', 'USER_SUSPENDED', target => {
    ensureState(target, 'active', 'suspensos');
    return { status: 'suspended' };
  });
}

export function reactivateUser(actor: UserDocument, targetUid: string) {
  return mutateUser(actor, targetUid, 'reactivate', 'USER_REACTIVATED', target => {
    ensureState(target, 'suspended', 'reativados');
    if (!target.role) throw new AppError(409, 'ROLE_REQUIRED', 'Defina um cargo antes de reativar o usuário.');
    return { status: 'active' };
  });
}
