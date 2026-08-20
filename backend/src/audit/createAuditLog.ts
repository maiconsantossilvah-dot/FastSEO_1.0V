import type { Transaction } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin.js';

export type AuditAction =
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_ROLE_CHANGED'
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED';

interface AuditLogInput {
  actorUid: string;
  action: AuditAction;
  targetUid: string;
  previousValue: unknown;
  newValue: unknown;
}

export function createAuditLog(transaction: Transaction, input: AuditLogInput): void {
  const ref = adminDb.collection('auditLogs').doc();
  transaction.create(ref, {
    ...input,
    createdAt: FieldValue.serverTimestamp(),
  });
}
