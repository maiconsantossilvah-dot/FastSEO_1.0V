import { auth } from '../firebase/firebase.js';
import { APP_CONFIG } from '../config.js';

const EMPTY_STATE = Object.freeze({ user: null, permissions: null });
const WAKE_RETRY_DELAYS = Object.freeze([0, 3000, 7000, 12000, 18000, 25000]);
const RETRYABLE_STATUS = new Set([502, 503, 504]);
let state = EMPTY_STATE;
let readOnlyObserver = null;

export class UsersApiError extends Error {
  constructor(message, code = 'REQUEST_FAILED', status = 0) {
    super(message);
    this.name = 'UsersApiError';
    this.code = code;
    this.status = status;
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function request(path, options = {}) {
  const { retryOnWake = false, ...fetchOptions } = options;
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new UsersApiError('Sua sessão expirou. Entre novamente.', 'AUTH_REQUIRED', 401);

  const token = await firebaseUser.getIdToken();
  const retryDelays = retryOnWake ? WAKE_RETRY_DELAYS : [0];

  for (const [attempt, wait] of retryDelays.entries()) {
    if (wait) await delay(wait);

    let response;
    try {
      const timeout = AbortSignal.timeout(30000);
      const requestSignal = fetchOptions.signal
        ? AbortSignal.any([fetchOptions.signal, timeout])
        : timeout;
      response = await fetch(`${APP_CONFIG.usersApiBaseUrl}${path}`, {
        ...fetchOptions,
        signal: requestSignal,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
          ...fetchOptions.headers,
        },
      });
    } catch {
      if (attempt < retryDelays.length - 1) continue;
      throw new UsersApiError(
        retryOnWake
          ? 'O serviço gratuito ainda está iniciando. Aguarde alguns segundos e verifique novamente.'
          : 'O serviço de acesso está indisponível. Verifique se o backend foi iniciado.',
        'BACKEND_UNAVAILABLE',
      );
    }

    if (RETRYABLE_STATUS.has(response.status)) {
      if (attempt < retryDelays.length - 1) {
        await response.body?.cancel().catch(() => {});
        continue;
      }
      throw new UsersApiError(
        retryOnWake
          ? 'O serviço gratuito ainda está iniciando. Aguarde alguns segundos e verifique novamente.'
          : 'O serviço de acesso está temporariamente indisponível.',
        'BACKEND_UNAVAILABLE',
        response.status,
      );
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new UsersApiError(
        payload?.error?.message || 'Não foi possível concluir a solicitação.',
        payload?.error?.code || 'REQUEST_FAILED',
        response.status,
      );
    }
    return payload;
  }

  throw new UsersApiError(
    'O serviço gratuito ainda está iniciando. Aguarde alguns segundos e verifique novamente.',
    'BACKEND_UNAVAILABLE',
  );
}

function isSearchControl(control) {
  return control.matches('input[type="search"], [data-readonly-allowed]');
}

function lockReadOnlyControls(root = document) {
  if (!state.user || state.permissions?.editContent !== false) return;

  root.querySelectorAll?.('input, textarea').forEach(control => {
    if (isSearchControl(control) || control.closest('#hiddenApiInputs')) return;
    control.readOnly = true;
    control.setAttribute('aria-readonly', 'true');
  });
  root.querySelectorAll?.('select').forEach(control => {
    if (control.closest('#hiddenApiInputs')) return;
    control.disabled = true;
  });

  const mutationWords = /adicionar|salvar|editar|excluir|limpar|restaurar|importar|processar|gerar|regenerar|colar/i;
  root.querySelectorAll?.('button').forEach(button => {
    if (button.matches('.modal-close, [id*="Close"], [id*="close"], [id*="Copy"], [id*="copy"], [id*="Download"], [id*="download"], [role="tab"]')) return;
    const label = `${button.id} ${button.textContent} ${button.title}`;
    if (mutationWords.test(label)) {
      button.disabled = true;
      button.title = 'Modo espectador: ação disponível somente para leitura.';
    }
  });
}

function observeReadOnlyUi() {
  readOnlyObserver?.disconnect();
  readOnlyObserver = null;
  if (state.permissions?.editContent !== false) return;
  lockReadOnlyControls(document);
  readOnlyObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node instanceof HTMLElement) lockReadOnlyControls(node);
    }));
  });
  readOnlyObserver.observe(document.body, { childList: true, subtree: true });
}

export const UserAccess = {
  request(path, options) { return request(path, options); },

  async initialize() {
    const payload = await request('/access-requests', { method: 'POST', retryOnWake: true });
    state = Object.freeze({ user: payload.user, permissions: payload.permissions });
    observeReadOnlyUi();
    document.dispatchEvent(new CustomEvent('fastseo:accessChanged', { detail: state }));
    return state;
  },

  clear() {
    state = EMPTY_STATE;
    readOnlyObserver?.disconnect();
    readOnlyObserver = null;
  },

  current() { return state; },
  can(permission) { return Boolean(state.permissions?.[permission]); },

  assert(permission) {
    if (!this.can(permission)) {
      throw new UsersApiError('O modo espectador não permite alterar dados.', 'FORBIDDEN', 403);
    }
  },

  enforceReadOnly(root) { lockReadOnlyControls(root); },

  listUsers() { return request('/users'); },
  approve(uid) { return request(`/users/${encodeURIComponent(uid)}/approve`, { method: 'POST' }); },
  reject(uid) { return request(`/users/${encodeURIComponent(uid)}/reject`, { method: 'POST' }); },
  changeRole(uid, role) {
    return request(`/users/${encodeURIComponent(uid)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
  suspend(uid) { return request(`/users/${encodeURIComponent(uid)}/suspend`, { method: 'POST' }); },
  reactivate(uid) { return request(`/users/${encodeURIComponent(uid)}/reactivate`, { method: 'POST' }); },
};
