// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({ currentUser: null }));

vi.mock('../../src/firebase/firebase.js', () => ({
  auth: authState,
  getAppCheckToken: vi.fn(async () => 'app-check-token'),
}));
vi.mock('../../src/config.js', () => ({
  APP_CONFIG: { usersApiBaseUrl: 'https://backend.example/api' },
}));

const { UserAccess, UsersApiError } = await import('../../src/services/userAccess.js');

function firebaseUser() {
  return {
    uid: 'firebase-user-1',
    email: 'user@example.com',
    displayName: 'Usuário Teste',
    getIdToken: vi.fn(async () => 'firebase-token'),
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('UserAccess em modo degradado', () => {
  beforeEach(() => {
    UserAccess.clear();
    authState.currentUser = firebaseUser();
    document.body.innerHTML = '<main></main>';
    globalThis.fetch = vi.fn();
  });

  it('mantém o modo online quando o backend valida o usuário', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      user: { uid: 'firebase-user-1', role: 'owner', status: 'active' },
      permissions: { useFastSeo: true, editContent: true, viewUsers: true },
    }));

    const access = await UserAccess.initialize();

    expect(access.mode).toBe('online');
    expect(UserAccess.isDegraded()).toBe(false);
    expect(UserAccess.can('viewUsers')).toBe(true);
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer firebase-token',
      'X-Firebase-AppCheck': 'app-check-token',
    });
  });

  it('entra no modo local quando o backend identifica quota do Firestore', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      error: { code: 'FIRESTORE_QUOTA_EXHAUSTED', message: 'Quota esgotada.' },
    }, 503));

    const access = await UserAccess.initialize();

    expect(access.mode).toBe('degraded');
    expect(access.user).toMatchObject({ uid: 'firebase-user-1', role: 'collaborator', status: 'active' });
    expect(UserAccess.can('editContent')).toBe(true);
    expect(UserAccess.can('manageCategoryCatalog')).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('confirma no readiness a indisponibilidade reportada como erro 500 pelo backend antigo', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, 500))
      .mockResolvedValueOnce(jsonResponse({ status: 'not_ready', firestore: 'unavailable' }, 503));

    const access = await UserAccess.initialize();

    expect(access.mode).toBe('degraded');
    expect(fetch.mock.calls[1][0]).toBe('https://backend.example/ready');
  });

  it('não usa o modo degradado para contornar uma recusa de acesso', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      error: { code: 'USER_NOT_ACTIVE', message: 'Usuário suspenso.' },
    }, 403));

    await expect(UserAccess.initialize()).rejects.toEqual(expect.objectContaining({
      name: 'UsersApiError',
      code: 'USER_NOT_ACTIVE',
      status: 403,
    }));
    expect(UserAccess.isDegraded()).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('não libera acesso quando o readiness não confirma a falha do Firestore', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, 500))
      .mockResolvedValueOnce(jsonResponse({ status: 'ready', firestore: 'ok' }, 200));

    await expect(UserAccess.initialize()).rejects.toBeInstanceOf(UsersApiError);
    expect(UserAccess.isDegraded()).toBe(false);
  });
});
