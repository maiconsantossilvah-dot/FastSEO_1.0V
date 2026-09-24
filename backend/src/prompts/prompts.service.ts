import { FieldValue } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { adminDb } from '../firebaseAdmin.js';
import { consumeMutationQuota } from '../security/mutationQuota.js';
import type { UserDocument } from '../users/types.js';
import type { PromptKey } from './prompts.schema.js';

const promptRef = (key: PromptKey) => adminDb.collection('prompts').doc(key);

export async function updatePrompt(actor: UserDocument, key: PromptKey, value: string) {
  const ref = promptRef(key);
  const revision = await adminDb.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    await consumeMutationQuota(transaction, actor.uid, 'prompts', config.promptDailyWriteLimit);
    const nextRevision = Number(previous.data()?.revision || 0) + 1;
    transaction.set(ref, {
      key,
      value,
      revision: nextRevision,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });
    transaction.create(adminDb.collection('auditLogs').doc(), {
      action: 'PROMPT_UPDATED',
      actorUid: actor.uid,
      targetId: key,
      details: {
        previousLength: String(previous.data()?.value || '').length,
        newLength: value.length,
        revision: nextRevision,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    return nextRevision;
  });
  return { key, revision, updated: true };
}

export async function deletePrompt(actor: UserDocument, key: PromptKey) {
  const ref = promptRef(key);
  const deleted = await adminDb.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    if (!previous.exists) return false;
    await consumeMutationQuota(transaction, actor.uid, 'prompts', config.promptDailyWriteLimit);
    transaction.delete(ref);
    transaction.create(adminDb.collection('auditLogs').doc(), {
      action: 'PROMPT_DELETED',
      actorUid: actor.uid,
      targetId: key,
      details: {
        previousLength: String(previous.data()?.value || '').length,
        revision: Number(previous.data()?.revision || 0),
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  return { key, deleted };
}
