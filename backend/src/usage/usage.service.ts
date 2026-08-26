import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin.js';
import type { UserDocument } from '../users/types.js';
import { aggregateUsageEvents, type StoredUsageEvent } from './usage.analytics.js';
import type { UsageAnalyticsQuery, UsageEventInput } from './usage.schema.js';
import { AppError } from '../errors.js';

const eventsRef = () => adminDb.collection('usageEvents');
const dailyRef = () => adminDb.collection('usageDaily');
const SAO_PAULO_OFFSET = '-03:00';

function saoPauloDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function totals(event: UsageEventInput) {
  return event.calls.reduce((sum, call) => ({
    requests: sum.requests + 1,
    inputTokens: sum.inputTokens + call.inputTokens,
    outputTokens: sum.outputTokens + call.outputTokens,
    thinkingTokens: sum.thinkingTokens + call.thinkingTokens,
    cachedTokens: sum.cachedTokens + call.cachedTokens,
    totalTokens: sum.totalTokens + call.totalTokens,
  }), { requests: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, cachedTokens: 0, totalTokens: 0 });
}

export async function recordUsageEvent(actor: UserDocument, event: UsageEventInput) {
  const eventRef = eventsRef().doc(`${actor.uid}__${event.eventId}`);
  const now = Timestamp.now();
  const day = saoPauloDay(now.toDate());
  const aggregateRef = dailyRef().doc(`${day}__${actor.uid}`);
  const tokenTotals = totals(event);

  const duplicate = await adminDb.runTransaction(async transaction => {
    if ((await transaction.get(eventRef)).exists) return true;

    transaction.create(eventRef, {
      ...event,
      uid: actor.uid,
      userEmail: actor.email,
      userDisplayName: actor.displayName,
      day,
      ...tokenTotals,
      createdAt: now,
    });
    transaction.set(aggregateRef, {
      day,
      uid: actor.uid,
      userEmail: actor.email,
      userDisplayName: actor.displayName,
      runs: FieldValue.increment(1),
      approved: FieldValue.increment(event.status === 'aprovado' ? 1 : 0),
      rejected: FieldValue.increment(event.status === 'reprovado' ? 1 : 0),
      errors: FieldValue.increment(event.status === 'erro' ? 1 : 0),
      durationMs: FieldValue.increment(event.durationMs),
      requests: FieldValue.increment(tokenTotals.requests),
      inputTokens: FieldValue.increment(tokenTotals.inputTokens),
      outputTokens: FieldValue.increment(tokenTotals.outputTokens),
      thinkingTokens: FieldValue.increment(tokenTotals.thinkingTokens),
      cachedTokens: FieldValue.increment(tokenTotals.cachedTokens),
      totalTokens: FieldValue.increment(tokenTotals.totalTokens),
      updatedAt: now,
    }, { merge: true });
    return false;
  });

  return { accepted: true, duplicate, eventId: event.eventId };
}

export async function getUsageAnalytics(range: UsageAnalyticsQuery) {
  const from = Timestamp.fromDate(new Date(`${range.from}T00:00:00${SAO_PAULO_OFFSET}`));
  const exclusiveToDate = new Date(`${range.to}T00:00:00${SAO_PAULO_OFFSET}`);
  exclusiveToDate.setUTCDate(exclusiveToDate.getUTCDate() + 1);
  const to = Timestamp.fromDate(exclusiveToDate);
  const pageSize = 1000;
  const maximumEvents = 100_000;
  const baseQuery = eventsRef()
    .where('createdAt', '>=', from)
    .where('createdAt', '<', to)
    .orderBy('createdAt', 'asc');
  const documents: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    const pageQuery: FirebaseFirestore.Query = cursor
      ? baseQuery.startAfter(cursor).limit(pageSize)
      : baseQuery.limit(pageSize);
    const page: FirebaseFirestore.QuerySnapshot = await pageQuery.get();
    documents.push(...page.docs);
    if (documents.length > maximumEvents) {
      throw new AppError(413, 'ANALYTICS_RANGE_TOO_LARGE', 'O período possui eventos demais. Consulte um intervalo menor.');
    }
    if (page.size < pageSize) break;
    cursor = page.docs.at(-1) || null;
  }

  const events = documents.map(doc => {
    const data = doc.data();
    return {
      uid: String(data.uid || ''),
      userEmail: String(data.userEmail || ''),
      userDisplayName: String(data.userDisplayName || ''),
      status: data.status,
      durationMs: Number(data.durationMs || 0),
      category: String(data.category || ''),
      calls: Array.isArray(data.calls) ? data.calls : [],
      createdAt: data.createdAt?.toDate?.() || new Date(0),
      day: String(data.day || ''),
    } as StoredUsageEvent;
  });

  return {
    range,
    truncated: false,
    ...aggregateUsageEvents(events),
  };
}
