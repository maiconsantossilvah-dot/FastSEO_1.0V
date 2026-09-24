import { Timestamp } from 'firebase-admin/firestore';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { adminDb } from '../firebaseAdmin.js';
import { consumeMutationQuota } from '../security/mutationQuota.js';
import type { UserDocument } from '../users/types.js';
import type { HistoryCreateInput, HistoryUpdateInput } from './history.schema.js';

const historyRef = (uid: string) => adminDb.collection('users').doc(uid).collection('history');

function displayDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

async function pruneHistory(uid: string) {
  while (true) {
    const snapshot = await historyRef(uid)
      .orderBy('ts', 'desc')
      .limit(config.historyMaxItems + 400)
      .get();
    const excess = snapshot.docs.slice(config.historyMaxItems);
    if (!excess.length) return;

    const batch = adminDb.batch();
    excess.forEach(document => batch.delete(document.ref));
    await batch.commit();
    if (excess.length < 400) return;
  }
}

export async function createHistoryItem(actor: UserDocument, input: HistoryCreateInput) {
  const ref = historyRef(actor.uid).doc();
  const now = Timestamp.now();
  await adminDb.runTransaction(async transaction => {
    await consumeMutationQuota(transaction, actor.uid, 'history', config.historyDailyWriteLimit);
    transaction.create(ref, {
      ...input,
      data: displayDate(now.toDate()),
      ts: now,
      createdBy: actor.uid,
    });
  });
  await pruneHistory(actor.uid);
  return { id: ref.id };
}

export async function updateHistoryItem(actor: UserDocument, id: string, input: HistoryUpdateInput) {
  const ref = historyRef(actor.uid).doc(id);
  await adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AppError(404, 'HISTORY_NOT_FOUND', 'Item do histórico não encontrado.');
    await consumeMutationQuota(transaction, actor.uid, 'history', config.historyDailyWriteLimit);
    transaction.update(ref, { ...input, updatedAt: Timestamp.now() });
  });
  return { id, updated: true };
}

export async function clearHistory(actor: UserDocument) {
  await adminDb.runTransaction(async transaction => {
    await consumeMutationQuota(transaction, actor.uid, 'history', config.historyDailyWriteLimit);
  });

  let deleted = 0;
  while (true) {
    const snapshot = await historyRef(actor.uid).limit(400).get();
    if (snapshot.empty) break;
    const batch = adminDb.batch();
    snapshot.docs.forEach(document => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
  return { deleted };
}
