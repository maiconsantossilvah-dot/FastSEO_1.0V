import { FieldValue } from 'firebase-admin/firestore';
import type { UserDocument } from '../users/types.js';
import { AppError } from '../errors.js';
import { adminDb } from '../firebaseAdmin.js';
import { resolveCategory } from './categoryResolver.js';
import { convertLegacyCatalog, slugifyCategory } from './legacyMigration.js';
import type { CategoryProfile } from './types.js';

const profilesRef = () => adminDb.collection('categoryProfiles');
const publishedRef = () => adminDb.collection('categoryCatalogPublished');
const catalogMetaRef = () => adminDb.collection('categoryCatalog').doc('meta');

function iso(value: any): string | null {
  return value?.toDate?.().toISOString?.() || (typeof value === 'string' ? value : null);
}

function publicProfile(profile: CategoryProfile) {
  return {
    ...profile,
    createdAt: iso(profile.createdAt),
    updatedAt: iso(profile.updatedAt),
    publishedAt: iso(profile.publishedAt),
  };
}

function fromDoc(doc: FirebaseFirestore.DocumentSnapshot): CategoryProfile {
  return { id: doc.id, ...doc.data() } as CategoryProfile;
}

function sortProfiles(profiles: CategoryProfile[]): CategoryProfile[] {
  return profiles.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function catalogVersion(): Promise<number> {
  const meta = await catalogMetaRef().get();
  return Number(meta.data()?.version || 0);
}

function audit(action: string, actor: UserDocument, targetId: string, details: Record<string, unknown> = {}) {
  return adminDb.collection('auditLogs').add({
    action,
    actorUid: actor.uid,
    targetId,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function uniqueId(name: string): Promise<string> {
  const base = slugifyCategory(name);
  let id = base;
  let suffix = 2;
  while ((await profilesRef().doc(id).get()).exists) id = `${base}-${suffix++}`;
  return id;
}

async function assertParent(parentId: string | null | undefined, ownId?: string): Promise<void> {
  if (!parentId) return;
  if (parentId === ownId) throw new AppError(400, 'INVALID_PARENT', 'Uma categoria não pode herdar dela mesma.');
  const parent = await profilesRef().doc(parentId).get();
  if (!parent.exists) throw new AppError(400, 'PARENT_NOT_FOUND', 'A categoria pai informada não existe.');
}

export async function listWorkingProfiles() {
  const snap = await profilesRef().get();
  return { profiles: sortProfiles(snap.docs.map(fromDoc)).map(publicProfile), catalogVersion: await catalogVersion() };
}

export async function getPublishedCatalog() {
  const snap = await publishedRef().get();
  return {
    version: await catalogVersion(),
    profiles: sortProfiles(snap.docs.map(fromDoc)).map(publicProfile),
  };
}

export async function exportCategoryBackup() {
  const [working, published, legacyCategories, legacySubcategories, version] = await Promise.all([
    profilesRef().get(), publishedRef().get(), adminDb.collection('categories').get(),
    adminDb.collection('subcategories').get(), catalogVersion(),
  ]);
  return {
    format: 'fastseo-category-backup',
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    catalogVersion: version,
    categoryProfiles: working.docs.map(doc => publicProfile(fromDoc(doc))),
    publishedProfiles: published.docs.map(doc => publicProfile(fromDoc(doc))),
    legacy: {
      categories: legacyCategories.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      subcategories: legacySubcategories.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    },
  };
}

export async function createProfile(actor: UserDocument, input: Omit<CategoryProfile, 'id' | 'revision'>) {
  await assertParent(input.parentId);
  const id = await uniqueId(input.name);
  const profile: CategoryProfile = {
    ...input,
    id,
    status: 'draft',
    revision: 1,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actor.uid,
  };
  await profilesRef().doc(id).create(profile);
  await audit('CATEGORY_CREATED', actor, id, { name: profile.name });
  return publicProfile(profile);
}

export async function updateProfile(actor: UserDocument, id: string, changes: Partial<CategoryProfile>) {
  await assertParent(changes.parentId, id);
  const ref = profilesRef().doc(id);
  const updated = await adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    const previous = fromDoc(snap);
    const next = {
      ...previous,
      ...changes,
      id,
      status: previous.status === 'archived' ? 'archived' : 'draft',
      revision: Number(previous.revision || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
    } as CategoryProfile;
    transaction.set(ref, next);
    return next;
  });
  await audit('CATEGORY_UPDATED', actor, id, { revision: updated.revision });
  return publicProfile(updated);
}

export async function publishProfile(actor: UserDocument, id: string) {
  const working = profilesRef().doc(id);
  const published = publishedRef().doc(id);
  const meta = catalogMetaRef();
  const result = await adminDb.runTransaction(async transaction => {
    const [workingSnap, metaSnap] = await Promise.all([transaction.get(working), transaction.get(meta)]);
    if (!workingSnap.exists) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    const profile = fromDoc(workingSnap);
    if (profile.status === 'archived') throw new AppError(409, 'CATEGORY_ARCHIVED', 'Uma categoria arquivada não pode ser publicada.');
    const version = Number(metaSnap.data()?.version || 0) + 1;
    const publication = {
      ...profile,
      status: 'published' as const,
      publishedAt: FieldValue.serverTimestamp(),
      publishedBy: actor.uid,
      publishedVersion: version,
    };
    transaction.set(published, publication);
    transaction.set(working, publication);
    transaction.set(meta, { version, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
    return { profile: publication, version };
  });
  await audit('CATEGORY_PUBLISHED', actor, id, { catalogVersion: result.version });
  return { profile: publicProfile(result.profile), catalogVersion: result.version };
}

export async function archiveProfile(actor: UserDocument, id: string) {
  const working = profilesRef().doc(id);
  const published = publishedRef().doc(id);
  const meta = catalogMetaRef();
  const version = await adminDb.runTransaction(async transaction => {
    const [workingSnap, publishedSnap, metaSnap] = await Promise.all([
      transaction.get(working), transaction.get(published), transaction.get(meta),
    ]);
    if (!workingSnap.exists) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    const nextVersion = Number(metaSnap.data()?.version || 0) + (publishedSnap.exists ? 1 : 0);
    transaction.set(working, {
      status: 'archived', updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid,
    }, { merge: true });
    if (publishedSnap.exists) transaction.delete(published);
    if (publishedSnap.exists) transaction.set(meta, {
      version: nextVersion, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid,
    }, { merge: true });
    return nextVersion;
  });
  await audit('CATEGORY_ARCHIVED', actor, id, { catalogVersion: version });
  return { id, status: 'archived', catalogVersion: version };
}

export async function resolvePublishedCategory(input: string) {
  const catalog = await getPublishedCatalog();
  const resolution = resolveCategory(input, catalog.profiles as CategoryProfile[], catalog.version);
  return { resolution, catalogVersion: catalog.version };
}

function previewProfiles(profiles: CategoryProfile[], existingIds: Set<string>) {
  const seen = new Set<string>();
  const conflicts: Array<{ id: string; reason: string }> = [];
  const items = profiles.map(profile => {
    if (seen.has(profile.id)) conflicts.push({ id: profile.id, reason: 'ID duplicado no arquivo.' });
    seen.add(profile.id);
    return { id: profile.id, name: profile.name, action: existingIds.has(profile.id) ? 'update' : 'create', parentId: profile.parentId };
  });
  return {
    total: profiles.length,
    creates: items.filter(item => item.action === 'create').length,
    updates: items.filter(item => item.action === 'update').length,
    conflicts,
    items,
    profiles,
  };
}

export async function previewImport(profiles: CategoryProfile[]) {
  const existing = await profilesRef().get();
  return previewProfiles(profiles, new Set(existing.docs.map(doc => doc.id)));
}

export async function commitImport(actor: UserDocument, profiles: CategoryProfile[], source = 'import') {
  const preview = await previewImport(profiles);
  if (preview.conflicts.length) throw new AppError(409, 'IMPORT_CONFLICT', 'A importação possui conflitos que precisam ser corrigidos.');
  const job = adminDb.collection('categoryMigrationJobs').doc();
  const batch = adminDb.batch();
  batch.create(job, {
    source, status: 'completed', total: profiles.length, actorUid: actor.uid, createdAt: FieldValue.serverTimestamp(),
  });
  for (const profile of profiles) {
    const ref = profilesRef().doc(profile.id);
    batch.set(ref, {
      ...profile,
      status: 'draft',
      source,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      createdAt: profile.createdAt || FieldValue.serverTimestamp(),
      createdBy: profile.createdBy || actor.uid,
    }, { merge: true });
  }
  await batch.commit();
  await audit('CATEGORY_IMPORT_COMMITTED', actor, job.id, { source, total: profiles.length });
  return { jobId: job.id, imported: profiles.length, status: 'completed' };
}

export async function previewLegacyMigration() {
  const [categories, subcategories, existing] = await Promise.all([
    adminDb.collection('categories').get(),
    adminDb.collection('subcategories').get(),
    profilesRef().get(),
  ]);
  const converted = convertLegacyCatalog(
    categories.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[],
    subcategories.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[],
  );
  return previewProfiles(converted, new Set(existing.docs.map(doc => doc.id)));
}

export async function commitLegacyMigration(actor: UserDocument) {
  const preview = await previewLegacyMigration();
  return commitImport(actor, preview.profiles, 'legacy-migration');
}
