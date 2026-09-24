import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { AppError } from '../errors.js';
import { adminDb } from '../firebaseAdmin.js';

export type MutationQuotaKind = 'history' | 'prompts';

function quotaDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * Cota persistente: continua valendo mesmo após reinício ou novo deploy do
 * backend. Deve ser chamada antes de qualquer outra escrita da transação.
 */
export async function consumeMutationQuota(
  transaction: Transaction,
  uid: string,
  kind: MutationQuotaKind,
  limit: number,
) {
  const day = quotaDay();
  const ref = adminDb.collection('mutationQuotas').doc(`${day}__${uid}__${kind}`);
  const snapshot = await transaction.get(ref);
  const count = Number(snapshot.data()?.count || 0);
  if (count >= limit) {
    throw new AppError(429, 'DAILY_WRITE_LIMIT_EXCEEDED', 'Você atingiu o limite diário de alterações. Tente novamente amanhã.');
  }

  transaction.set(ref, {
    uid,
    kind,
    day,
    count: count + 1,
    limit,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
