import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

let environment;

async function seedUser(uid, role, status = 'active') {
  await environment.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', uid), { uid, role, status });
  });
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-fastseo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await seedUser('owner-1', 'owner');
  await seedUser('admin-1', 'admin');
  await seedUser('collab-1', 'collaborator');
  await seedUser('viewer-1', 'viewer');
});

afterAll(async () => environment.cleanup());

describe('isolamento do histórico', () => {
  it('permite que colaborador grave e leia apenas o próprio histórico', async () => {
    const ownDb = environment.authenticatedContext('collab-1').firestore();
    const otherDb = environment.authenticatedContext('viewer-1').firestore();
    const reference = doc(ownDb, 'users', 'collab-1', 'history', 'item-1');

    await assertSucceeds(setDoc(reference, { ficha: 'Produto', ts: new Date() }));
    await assertSucceeds(getDoc(reference));
    await assertFails(getDoc(doc(otherDb, 'users', 'collab-1', 'history', 'item-1')));
    const adminDb = environment.authenticatedContext('admin-1').firestore();
    await assertFails(getDoc(doc(adminDb, 'users', 'collab-1', 'history', 'item-1')));
  });

  it('impede espectador de alterar histórico', async () => {
    const db = environment.authenticatedContext('viewer-1').firestore();
    await assertFails(setDoc(doc(db, 'users', 'viewer-1', 'history', 'item-1'), { ficha: 'X' }));
  });
});

describe('fronteiras de escrita', () => {
  it('bloqueia escrita cliente nas categorias e subcategorias legadas', async () => {
    const db = environment.authenticatedContext('owner-1').firestore();
    await assertFails(setDoc(doc(db, 'categories', 'teste'), { nome: 'Teste' }));
    await assertFails(deleteDoc(doc(db, 'subcategories', 'teste')));
  });

  it('restringe prompts a owner/admin e telemetria ao backend', async () => {
    const ownerDb = environment.authenticatedContext('owner-1').firestore();
    const collaboratorDb = environment.authenticatedContext('collab-1').firestore();
    await assertSucceeds(setDoc(doc(ownerDb, 'prompts', 'P1'), { value: 'Prompt' }));
    await assertFails(setDoc(doc(collaboratorDb, 'prompts', 'P1'), { value: 'Alterado' }));
    await assertFails(setDoc(doc(ownerDb, 'usageEvents', 'fake'), { totalTokens: 1 }));
  });
});
