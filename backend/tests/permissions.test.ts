import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { assertOwnerContinuity, assertTargetAllowed, permissionsFor } from '../src/auth/permissions.js';
import type { UserDocument, UserRole, UserStatus } from '../src/users/types.js';

function user(role: UserRole | null, status: UserStatus = 'active', uid = String(role)): UserDocument {
  return {
    uid,
    email: `${uid}@fastseo.test`,
    displayName: uid,
    role,
    status,
    createdAt: Timestamp.now(),
    approvedAt: status === 'active' ? Timestamp.now() : null,
    approvedBy: status === 'active' ? 'owner' : null,
  };
}

describe('permissões explícitas', () => {
  it('mantém viewer realmente sem escrita', () => {
    expect(permissionsFor('viewer')).toMatchObject({
      useFastSeo: true,
      editContent: false,
      viewUsers: false,
      editPrompts: false,
      manageRoles: false,
      manageCategoryCatalog: false,
    });
  });

  it('restringe o catálogo de categorias a admin e owner', () => {
    expect(permissionsFor('viewer')?.manageCategoryCatalog).toBe(false);
    expect(permissionsFor('collaborator')?.manageCategoryCatalog).toBe(false);
    expect(permissionsFor('admin')?.manageCategoryCatalog).toBe(true);
    expect(permissionsFor('owner')?.manageCategoryCatalog).toBe(true);
  });

  it('permite que admin gerencie apenas collaborator e viewer', () => {
    const admin = user('admin', 'active', 'admin-a');
    expect(() => assertTargetAllowed(admin, user('viewer'), 'changeRole', 'collaborator')).not.toThrow();
    expect(() => assertTargetAllowed(admin, user('collaborator'), 'suspend')).not.toThrow();
    expect(() => assertTargetAllowed(admin, user('admin'), 'suspend')).toThrow(/colaboradores e espectadores/i);
    expect(() => assertTargetAllowed(admin, user('owner'), 'changeRole', 'viewer')).toThrow(/colaboradores e espectadores/i);
  });

  it('impede que admin atribua admin ou owner', () => {
    const admin = user('admin', 'active', 'admin-a');
    expect(() => assertTargetAllowed(admin, user('viewer'), 'changeRole', 'admin')).toThrow();
    expect(() => assertTargetAllowed(admin, user('viewer'), 'changeRole', 'owner')).toThrow();
  });

  it('aprova ou rejeita somente solicitações ainda sem cargo', () => {
    const admin = user('admin');
    expect(() => assertTargetAllowed(admin, user(null, 'pending', 'new-user'), 'approve')).not.toThrow();
    expect(() => assertTargetAllowed(admin, user(null, 'pending', 'new-user'), 'reject')).not.toThrow();
  });

  it('owner pode atribuir todos os cargos', () => {
    const owner = user('owner', 'active', 'owner-a');
    for (const role of ['owner', 'admin', 'collaborator', 'viewer'] as const) {
      expect(() => assertTargetAllowed(owner, user('viewer'), 'changeRole', role)).not.toThrow();
    }
  });

  it('protege o último owner ativo', () => {
    const owner = user('owner', 'active', 'owner-a');
    expect(() => assertOwnerContinuity(owner, 1)).toThrow(/último proprietário ativo/i);
    expect(() => assertOwnerContinuity(owner, 2)).not.toThrow();
  });
});
