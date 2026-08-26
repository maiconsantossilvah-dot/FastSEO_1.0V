import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin.js';
import { AppError } from '../errors.js';
import type { UserDocument } from '../users/types.js';
import { normalizeMatchText } from '../categories/categoryResolver.js';
import { resolveCategory } from '../categories/categoryResolver.js';
import { slugifyCategory } from '../categories/legacyMigration.js';
import type { CategoryProfile } from '../categories/types.js';
import type { TitleRuleInput } from './titleRules.schema.js';

const rulesRef = () => adminDb.collection('titleRules');
const CACHE_TTL_MS = 60_000;
let cachedRules: { expiresAt: number; rules: ReturnType<typeof publicRule>[] } | null = null;

function invalidateRuleCache() {
  cachedRules = null;
}

function publicRule(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: String(data.name || ''),
    formula: String(data.formula || ''),
    example: String(data.example || ''),
    source: String(data.source || 'manual'),
    revision: Number(data.revision || 1),
  };
}

export async function listTitleRules() {
  if (cachedRules && cachedRules.expiresAt > Date.now()) {
    return cachedRules.rules.map(rule => ({ ...rule }));
  }
  const [current, legacy] = await Promise.all([
    rulesRef().get(),
    adminDb.collection('subcategories').get(),
  ]);
  const allCurrent = current.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Array<{
    id: string;
    name?: unknown;
    deleted?: unknown;
    [key: string]: unknown;
  }>;
  const currentNames = new Set(allCurrent.map(rule => normalizeMatchText(rule.name)));
  const rules = allCurrent.filter(rule => !rule.deleted)
    .map(rule => publicRule(rule.id, rule as FirebaseFirestore.DocumentData));
  legacy.docs.forEach(doc => {
    const data = doc.data();
    const name = String(data.nome || '').trim();
    if (!name || currentNames.has(normalizeMatchText(name))) return;
    rules.push({
      id: slugifyCategory(name),
      name,
      formula: String(data.formula || ''),
      example: String(data.ex || ''),
      source: 'legacy',
      revision: 1,
    });
  });
  const sorted = rules.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  cachedRules = { expiresAt: Date.now() + CACHE_TTL_MS, rules: sorted };
  return sorted.map(rule => ({ ...rule }));
}

export function matchTitleRule(input: string, rules: ReturnType<typeof publicRule>[]) {
  const candidates: CategoryProfile[] = rules.map(rule => ({
    id: rule.id,
    name: rule.name,
    status: 'published',
    profileType: 'compact',
    parentId: null,
    aliases: [],
    negativeTerms: [],
    requiredFields: [],
    optionalFields: [],
    idealSheet: '',
    sheetNoticeType: 'normal',
    titleRule: { formula: rule.formula, example: rule.example },
    modifiers: [],
    qaSchema: null,
    schemaVersion: 2,
    revision: rule.revision,
    source: rule.source === 'legacy' ? 'legacy-migration' : 'manual',
  }));
  const match = resolveCategory(input, candidates);
  if (!match) return null;
  const rule = rules.find(item => item.id === match.family.id);
  return rule ? { ...rule, confidence: match.confidence, evidence: match.evidence } : null;
}

export async function resolveTitleRule(input: string) {
  return matchTitleRule(input, await listTitleRules());
}

export async function upsertTitleRule(actor: UserDocument, previousId: string, input: TitleRuleInput) {
  const nextId = slugifyCategory(input.name);
  const previousRef = rulesRef().doc(previousId);
  const nextRef = rulesRef().doc(nextId);
  const legacyName = previousId === nextId ? '' : (await adminDb.collection('subcategories').get()).docs
    .map(doc => String(doc.data().nome || '').trim())
    .find(name => slugifyCategory(name) === previousId) || '';
  const result = await adminDb.runTransaction(async transaction => {
    const existing = await transaction.get(nextRef);
    if (previousId !== nextId && existing.exists) {
      throw new AppError(409, 'TITLE_RULE_CONFLICT', 'Já existe uma regra com esse nome.');
    }
    const previous = previousId === nextId ? existing : await transaction.get(previousRef);
    const revision = Number(previous.data()?.revision || 0) + 1;
    const document = {
      name: input.name,
      formula: input.formula,
      example: input.example,
      source: 'manual',
      revision,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    };
    transaction.set(nextRef, document);
    if (previousId !== nextId) {
      // A marca de exclusão também cobre uma regra que ainda existe apenas na
      // coleção legada; sem ela, o nome antigo reapareceria após a renomeação.
      transaction.set(previousRef, {
        name: String(previous.data()?.name || legacyName || previousId),
        deleted: true,
        source: 'manual',
        revision,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actor.uid,
      });
    }
    transaction.create(adminDb.collection('auditLogs').doc(), {
      action: 'TITLE_RULE_UPSERTED', actorUid: actor.uid, targetId: nextId,
      details: { previousId, revision }, createdAt: FieldValue.serverTimestamp(),
    });
    return { id: nextId, ...document };
  });
  invalidateRuleCache();
  return publicRule(result.id, result);
}

export async function deleteTitleRule(actor: UserDocument, id: string) {
  const [current, legacy] = await Promise.all([
    rulesRef().doc(id).get(),
    adminDb.collection('subcategories').get(),
  ]);
  const legacyName = legacy.docs
    .map(doc => String(doc.data().nome || '').trim())
    .find(name => slugifyCategory(name) === id);
  const name = String(current.data()?.name || legacyName || id);
  await adminDb.runTransaction(async transaction => {
    const ref = rulesRef().doc(id);
    const snapshot = await transaction.get(ref);
    // Tombstone impede que uma regra removida reapareça pelo fallback legado.
    transaction.set(ref, {
      name,
      deleted: true,
      source: 'manual',
      revision: Number(snapshot.data()?.revision || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });
    transaction.create(adminDb.collection('auditLogs').doc(), {
      action: 'TITLE_RULE_DELETED', actorUid: actor.uid, targetId: id,
      details: {}, createdAt: FieldValue.serverTimestamp(),
    });
  });
  invalidateRuleCache();
  return { id, deleted: true };
}

export async function importTitleRules(actor: UserDocument, rules: TitleRuleInput[], replace: boolean) {
  const desired = new Map(rules.map(rule => [slugifyCategory(rule.name), rule]));
  if (desired.size !== rules.length) {
    throw new AppError(409, 'TITLE_RULE_IMPORT_DUPLICATE', 'A importação possui nomes duplicados ou equivalentes.');
  }

  const [existing, legacy] = await Promise.all([
    rulesRef().get(),
    replace ? adminDb.collection('subcategories').get() : Promise.resolve(null),
  ]);
  const existingById = new Map(existing.docs.map(doc => [doc.id, doc]));
  const legacyNames = new Map((legacy?.docs || []).map(doc => {
    const name = String(doc.data().nome || '').trim();
    return [slugifyCategory(name), name];
  }));
  const removedIds = replace
    ? [...new Set([
      ...existing.docs.filter(doc => !desired.has(doc.id)).map(doc => doc.id),
      ...[...legacyNames.keys()].filter(id => !desired.has(id)),
    ])]
    : [];
  const operationCount = removedIds.length + desired.size + 1;
  if (operationCount > 500) {
    throw new AppError(413, 'TITLE_RULE_IMPORT_TOO_LARGE', 'O lote excede o limite atômico. Divida a importação em partes menores.');
  }

  const batch = adminDb.batch();
  removedIds.forEach(id => {
    const ref = rulesRef().doc(id);
    const legacyName = legacyNames.get(id);
    if (!legacyName) {
      batch.delete(ref);
      return;
    }
    // Preserva o estado removido quando a mesma regra ainda existe no legado.
    batch.set(ref, {
      name: legacyName,
      deleted: true,
      source: 'import',
      revision: Number(existingById.get(id)?.data()?.revision || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    });
  });
  desired.forEach((rule, id) => batch.set(rulesRef().doc(id), {
    ...rule,
    source: 'import',
    revision: Number(existingById.get(id)?.data()?.revision || 0) + 1,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  }));
  batch.create(adminDb.collection('auditLogs').doc(), {
    action: 'TITLE_RULES_IMPORTED', actorUid: actor.uid, targetId: 'titleRules',
    details: { total: rules.length, replace }, createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  invalidateRuleCache();
  return { imported: rules.length, replaced: replace };
}
