// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const accessState = vi.hoisted(() => ({ user: null }));

vi.mock('../../src/services/userAccess.js', () => ({
  UserAccess: {
    current: () => ({ user: accessState.user }),
  },
}));

vi.mock('../../src/config.js', () => ({
  GEMINI_DEFAULT_MODEL: 'gemini-default-test',
}));

const { ApiSettings } = await import('../../src/services/apiSettings.js');

describe('ApiSettings BYOK', () => {
  beforeEach(() => {
    localStorage.clear();
    accessState.user = { uid: 'user-a', role: 'collaborator' };
  });

  it('isola chaves por usuário autenticado', () => {
    ApiSettings.setGeminiPrimary('key-user-a');
    expect(ApiSettings.getGeminiPrimary()).toBe('key-user-a');

    accessState.user = { uid: 'user-b', role: 'collaborator' };
    expect(ApiSettings.getGeminiPrimary()).toBe('');
    ApiSettings.setGeminiPrimary('key-user-b');

    accessState.user = { uid: 'user-a', role: 'collaborator' };
    expect(ApiSettings.getGeminiPrimary()).toBe('key-user-a');
  });

  it('não lê nem grava chaves sem uma sessão associada', () => {
    accessState.user = null;
    ApiSettings.setGeminiPrimary('orphan-key');
    expect(ApiSettings.getGeminiPrimary()).toBe('');
    expect(localStorage.length).toBe(0);
  });

  it('migra a chave legada somente para um perfil administrativo', () => {
    localStorage.setItem('gemini_key', 'legacy-key');
    accessState.user = { uid: 'owner-1', role: 'owner' };

    expect(ApiSettings.getGeminiPrimary()).toBe('legacy-key');
    expect(localStorage.getItem('gemini_key')).toBeNull();
    expect(localStorage.getItem('fastseo_byok:owner-1:gemini_key')).toBe('legacy-key');
  });

  it('não entrega uma chave legada a um colaborador', () => {
    localStorage.setItem('gemini_key', 'legacy-key');
    expect(ApiSettings.getGeminiPrimary()).toBe('');
    expect(localStorage.getItem('gemini_key')).toBe('legacy-key');
  });
});
