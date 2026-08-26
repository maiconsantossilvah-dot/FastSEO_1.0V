import { FieldValue } from 'firebase-admin/firestore';
import type { UserDocument } from '../users/types.js';
import { AppError } from '../errors.js';
import { adminDb } from '../firebaseAdmin.js';
import { normalizeMatchText, resolveCategory } from './categoryResolver.js';
import { convertLegacyCatalog, slugifyCategory } from './legacyMigration.js';
import type { CategoryProfile } from './types.js';
import type { CategoryProfileInput, CategoryProfilePatch } from './categories.schema.js';

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

function auditRecord(action: string, actor: UserDocument, targetId: string, details: Record<string, unknown> = {}) {
  return {
    action,
    actorUid: actor.uid,
    targetId,
    details,
    createdAt: FieldValue.serverTimestamp(),
  };
}

async function assertParentGraph(
  transaction: FirebaseFirestore.Transaction,
  parentId: string | null | undefined,
  ownId?: string,
): Promise<void> {
  if (!parentId) return;
  const visited = new Set(ownId ? [ownId] : []);
  let currentId: string | null = parentId;
  let depth = 0;

  while (currentId) {
    if (visited.has(currentId)) {
      throw new AppError(409, 'CATEGORY_PARENT_CYCLE', 'A herança informada criaria um ciclo entre categorias.');
    }
    if (++depth > 50) {
      throw new AppError(409, 'CATEGORY_PARENT_DEPTH', 'A hierarquia de categorias excedeu o limite seguro.');
    }
    visited.add(currentId);
    const parent = await transaction.get(profilesRef().doc(currentId));
    if (!parent.exists) throw new AppError(400, 'PARENT_NOT_FOUND', 'A categoria pai informada não existe.');
    const data = fromDoc(parent);
    if (data.status === 'archived') {
      throw new AppError(409, 'PARENT_ARCHIVED', 'Uma categoria arquivada não pode ser usada como herança.');
    }
    currentId = data.parentId || null;
  }
}

export async function listWorkingProfiles() {
  const snap = await profilesRef().get();
  return { profiles: sortProfiles(snap.docs.map(fromDoc)).map(publicProfile), catalogVersion: await catalogVersion() };
}

export async function getPublishedCatalog() {
  // Perfil e versão são lidos na mesma transação para que o cache nunca associe
  // uma versão nova a um conjunto antigo de documentos.
  return adminDb.runTransaction(async transaction => {
    const [snap, meta] = await Promise.all([
      transaction.get(publishedRef()),
      transaction.get(catalogMetaRef()),
    ]);
    return {
      version: Number(meta.data()?.version || 0),
      profiles: sortProfiles(snap.docs.map(fromDoc)).map(publicProfile),
    };
  });
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

export async function createProfile(actor: UserDocument, input: CategoryProfileInput) {
  const base = slugifyCategory(input.name);
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const id = suffix === 1 ? base : `${base}-${suffix}`;
    const created = await adminDb.runTransaction(async transaction => {
      await assertParentGraph(transaction, input.parentId);
      const ref = profilesRef().doc(id);
      if ((await transaction.get(ref)).exists) return null;
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
      transaction.create(ref, profile);
      transaction.create(
        adminDb.collection('auditLogs').doc(),
        auditRecord('CATEGORY_CREATED', actor, id, { name: profile.name }),
      );
      return profile;
    });
    if (created) return publicProfile(created);
  }
  throw new AppError(409, 'CATEGORY_ID_CONFLICT', 'Não foi possível gerar um identificador único para a categoria.');
}

export async function updateProfile(
  actor: UserDocument,
  id: string,
  changes: Omit<CategoryProfilePatch, 'expectedRevision'>,
  expectedRevision: number,
) {
  const ref = profilesRef().doc(id);
  const updated = await adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    const previous = fromDoc(snap);
    if (Number(previous.revision || 0) !== expectedRevision) {
      throw new AppError(409, 'CATEGORY_REVISION_CONFLICT', 'A categoria foi alterada por outra pessoa. Atualize os dados antes de salvar novamente.');
    }
    await assertParentGraph(transaction, changes.parentId ?? previous.parentId, id);
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
    transaction.create(
      adminDb.collection('auditLogs').doc(),
      auditRecord('CATEGORY_UPDATED', actor, id, { fromRevision: previous.revision, revision: next.revision }),
    );
    return next;
  });
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
    transaction.create(
      adminDb.collection('auditLogs').doc(),
      auditRecord('CATEGORY_PUBLISHED', actor, id, { catalogVersion: version }),
    );
    return { profile: publication, version };
  });
  return { profile: publicProfile(result.profile), catalogVersion: result.version };
}

function legacySubcategoryId(name: string): string {
  return name.toLocaleLowerCase('pt-BR').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export async function deleteProfile(actor: UserDocument, id: string) {
  const working = profilesRef().doc(id);
  const published = publishedRef().doc(id);
  const legacy = adminDb.collection('categories').doc(id);
  const meta = catalogMetaRef();
  const result = await adminDb.runTransaction(async transaction => {
    const [workingSnap, publishedSnap, legacySnap, metaSnap] = await Promise.all([
      transaction.get(working), transaction.get(published), transaction.get(legacy), transaction.get(meta),
    ]);
    if (!workingSnap.exists && !publishedSnap.exists && !legacySnap.exists) {
      throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Categoria não encontrada.');
    }
    const children = await transaction.get(profilesRef().where('parentId', '==', id).limit(1));
    if (!children.empty) {
      throw new AppError(409, 'CATEGORY_HAS_CHILDREN', 'Remova ou altere a herança das categorias filhas antes de excluir esta categoria.');
    }
    const name = String(workingSnap.data()?.name || publishedSnap.data()?.name || legacySnap.data()?.nome || '');
    const legacyByNameSnap = name
      ? await transaction.get(adminDb.collection('categories').where('nome', '==', name))
      : null;
    const legacySubcategory = name ? adminDb.collection('subcategories').doc(legacySubcategoryId(name)) : null;
    const legacySubcategorySnap = legacySubcategory ? await transaction.get(legacySubcategory) : null;
    const nextVersion = Number(metaSnap.data()?.version || 0) + (publishedSnap.exists ? 1 : 0);
    if (workingSnap.exists) transaction.delete(working);
    if (publishedSnap.exists) transaction.delete(published);
    const legacyRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    if (legacySnap.exists) legacyRefs.set(legacy.path, legacy);
    legacyByNameSnap?.docs.forEach(doc => legacyRefs.set(doc.ref.path, doc.ref));
    legacyRefs.forEach(ref => transaction.delete(ref));
    if (legacySubcategory && legacySubcategorySnap?.exists) transaction.delete(legacySubcategory);
    if (publishedSnap.exists) transaction.set(meta, {
      version: nextVersion, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid,
    }, { merge: true });
    transaction.create(
      adminDb.collection('auditLogs').doc(),
      auditRecord('CATEGORY_DELETED', actor, id, { catalogVersion: nextVersion }),
    );
    return {
      version: nextVersion,
      removed: {
        working: workingSnap.exists,
        published: publishedSnap.exists,
        legacy: legacyRefs.size,
        legacySubcategory: Boolean(legacySubcategorySnap?.exists),
      },
    };
  });
  return { id, deleted: true, catalogVersion: result.version, removed: result.removed };
}

export async function resolvePublishedCategory(input: string) {
  const [catalog, legacyCategories, legacySubcategories] = await Promise.all([
    getPublishedCatalog(),
    adminDb.collection('categories').get(),
    adminDb.collection('subcategories').get(),
  ]);
  const published = catalog.profiles as CategoryProfile[];
  const publishedIds = new Set(published.map(profile => profile.id));
  const publishedNames = new Set(published.map(profile => normalizeMatchText(profile.name)));
  const legacyCategoryData = legacyCategories.docs.map(doc => ({ id: doc.id, ...doc.data() })) as
    Parameters<typeof convertLegacyCatalog>[0];
  const legacySubcategoryData = legacySubcategories.docs.map(doc => ({ id: doc.id, ...doc.data() })) as
    Parameters<typeof convertLegacyCatalog>[1];
  const legacy = convertLegacyCatalog(
    legacyCategoryData,
    legacySubcategoryData,
  ).filter(profile => !publishedIds.has(profile.id) && !publishedNames.has(normalizeMatchText(profile.name)));

  // Durante a migração o legado continua disponível, mas a decisão acontece
  // exclusivamente aqui. O navegador não mantém mais um segundo algoritmo.
  const resolution = resolveCategory(input, [...published, ...legacy], catalog.version);
  return { resolution, catalogVersion: catalog.version };
}

export function previewProfiles(profiles: CategoryProfile[], existingProfiles: CategoryProfile[]) {
  const existingIds = new Set(existingProfiles.map(profile => profile.id));
  const seen = new Set<string>();
  const conflicts: Array<{ id: string; reason: string }> = [];
  const items = profiles.map(profile => {
    if (seen.has(profile.id)) conflicts.push({ id: profile.id, reason: 'ID duplicado no arquivo.' });
    seen.add(profile.id);
    return { id: profile.id, name: profile.name, action: existingIds.has(profile.id) ? 'update' : 'create', parentId: profile.parentId };
  });

  // Valida a árvore resultante, e não somente o arquivo. Assim uma importação
  // não consegue deixar pai ausente, ciclo ou uma cadeia excessivamente funda.
  const parentById = new Map(existingProfiles.map(profile => [profile.id, profile.parentId || null]));
  profiles.forEach(profile => parentById.set(profile.id, profile.parentId || null));
  profiles.forEach(profile => {
    const visited = new Set([profile.id]);
    let parentId = profile.parentId || null;
    let depth = 0;
    while (parentId) {
      if (!parentById.has(parentId)) {
        conflicts.push({ id: profile.id, reason: `Categoria pai "${parentId}" não encontrada.` });
        break;
      }
      if (visited.has(parentId)) {
        conflicts.push({ id: profile.id, reason: 'A herança criaria um ciclo entre categorias.' });
        break;
      }
      if (++depth > 50) {
        conflicts.push({ id: profile.id, reason: 'A hierarquia excede o limite de 50 níveis.' });
        break;
      }
      visited.add(parentId);
      parentId = parentById.get(parentId) || null;
    }
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
  return previewProfiles(profiles, existing.docs.map(fromDoc));
}

export async function commitImport(actor: UserDocument, profiles: CategoryProfile[], source = 'import') {
  const existing = await profilesRef().get();
  const existingProfiles = existing.docs.map(fromDoc);
  const existingById = new Map(existingProfiles.map(profile => [profile.id, profile]));
  const preview = previewProfiles(profiles, existingProfiles);
  if (preview.conflicts.length) throw new AppError(409, 'IMPORT_CONFLICT', 'A importação possui conflitos que precisam ser corrigidos.');
  const job = adminDb.collection('categoryMigrationJobs').doc();
  const batch = adminDb.batch();
  batch.create(job, {
    source, status: 'completed', total: profiles.length, actorUid: actor.uid, createdAt: FieldValue.serverTimestamp(),
  });
  for (const profile of profiles) {
    const ref = profilesRef().doc(profile.id);
    const previous = existingById.get(profile.id);
    batch.set(ref, {
      ...profile,
      status: 'draft',
      source,
      revision: Number(previous?.revision || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actor.uid,
      createdAt: previous?.createdAt || FieldValue.serverTimestamp(),
      createdBy: previous?.createdBy || actor.uid,
    });
  }
  batch.create(
    adminDb.collection('auditLogs').doc(),
    auditRecord('CATEGORY_IMPORT_COMMITTED', actor, job.id, { source, total: profiles.length }),
  );
  await batch.commit();
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
  return previewProfiles(converted, existing.docs.map(fromDoc));
}

export async function commitLegacyMigration(actor: UserDocument) {
  const preview = await previewLegacyMigration();
  return commitImport(actor, preview.profiles, 'legacy-migration');
}
