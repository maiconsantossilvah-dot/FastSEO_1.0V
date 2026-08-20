import { UserAccess } from '../services/userAccess.js';
import { AppShell } from './AppShell.js';

const $ = id => document.getElementById(id);
const ROLE_LABELS = {
  owner: 'Proprietário',
  admin: 'Administrador',
  collaborator: 'Colaborador',
  viewer: 'Espectador',
};
const STATUS_LABELS = {
  pending: 'Aguardando aprovação',
  active: 'Ativo',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
};

let users = [];
let filter = 'all';
let busyUid = null;

function escapeHtml(value) {
  const el = document.createElement('div');
  el.textContent = String(value ?? '');
  return el.innerHTML;
}

function canManageTarget(target) {
  const actor = UserAccess.current().user;
  if (actor?.role === 'owner') return true;
  if (actor?.role !== 'admin') return false;
  return target.status === 'pending' || target.role === 'viewer' || target.role === 'collaborator';
}

function allowedRoles(target) {
  const actor = UserAccess.current().user;
  if (!canManageTarget(target)) return [];
  return actor?.role === 'owner'
    ? ['owner', 'admin', 'collaborator', 'viewer']
    : ['collaborator', 'viewer'];
}

function statusCounts() {
  return users.reduce((counts, user) => {
    counts[user.status] = (counts[user.status] || 0) + 1;
    return counts;
  }, { all: users.length });
}

function roleSelect(user) {
  const roles = allowedRoles(user);
  if (!roles.length || user.status !== 'active') {
    return `<span class="users-role-label">${ROLE_LABELS[user.role] || 'Sem cargo'}</span>`;
  }
  return `<label class="users-role-select"><span class="sr-only">Cargo de ${escapeHtml(user.displayName)}</span>
    <select data-user-role="${escapeHtml(user.uid)}" ${busyUid === user.uid ? 'disabled' : ''}>
      ${roles.map(role => `<option value="${role}" ${role === user.role ? 'selected' : ''}>${ROLE_LABELS[role]}</option>`).join('')}
    </select>
  </label>`;
}

function actionButtons(user) {
  if (!canManageTarget(user)) return '<span class="users-protected">Protegido pela hierarquia</span>';
  const disabled = busyUid === user.uid ? 'disabled' : '';
  if (user.status === 'pending') {
    return `<button class="btn btn-primary btn-sm" data-user-action="approve" data-uid="${escapeHtml(user.uid)}" ${disabled}>
        <i data-lucide="user-check"></i><span>Aprovar</span>
      </button>
      <button class="btn btn-secondary btn-sm" data-user-action="reject" data-uid="${escapeHtml(user.uid)}" ${disabled}>
        <i data-lucide="user-x"></i><span>Rejeitar</span>
      </button>`;
  }
  if (user.status === 'active') {
    return `<button class="btn btn-secondary btn-sm" data-user-action="suspend" data-uid="${escapeHtml(user.uid)}" ${disabled}>
      <i data-lucide="circle-pause"></i><span>Suspender</span>
    </button>`;
  }
  if (user.status === 'suspended') {
    return `<button class="btn btn-primary btn-sm" data-user-action="reactivate" data-uid="${escapeHtml(user.uid)}" ${disabled}>
      <i data-lucide="rotate-ccw"></i><span>Reativar</span>
    </button>`;
  }
  return '<span class="users-protected">Sem ações disponíveis</span>';
}

function userRow(user) {
  const actorUid = UserAccess.current().user?.uid;
  const initial = (user.displayName || user.email || '?').trim().slice(0, 1).toUpperCase();
  return `<article class="users-row" data-user-status="${user.status}">
    <div class="users-identity">
      <span class="users-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
      <span><strong>${escapeHtml(user.displayName || 'Sem nome')}${user.uid === actorUid ? ' <em>Você</em>' : ''}</strong>
      <small>${escapeHtml(user.email)}</small></span>
    </div>
    <span class="users-status users-status--${user.status}"><i data-lucide="${user.status === 'active' ? 'circle-check' : user.status === 'pending' ? 'clock-3' : user.status === 'suspended' ? 'circle-pause' : 'circle-x'}"></i>${STATUS_LABELS[user.status]}</span>
    <div>${roleSelect(user)}</div>
    <div class="users-actions">${actionButtons(user)}</div>
  </article>`;
}

function render() {
  const list = $('usersList');
  if (!list) return;
  const query = ($('usersSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const visible = users.filter(user => {
    const matchesFilter = filter === 'all' || user.status === filter;
    const haystack = `${user.displayName} ${user.email} ${user.role || ''}`.toLocaleLowerCase('pt-BR');
    return matchesFilter && (!query || haystack.includes(query));
  });
  list.innerHTML = visible.length
    ? visible.map(userRow).join('')
    : '<div class="ui-empty-state users-empty"><i data-lucide="users"></i><strong>Nenhum usuário encontrado</strong><p>Ajuste o filtro ou a busca para ver outros registros.</p></div>';

  const counts = statusCounts();
  document.querySelectorAll('[data-users-filter]').forEach(button => {
    const key = button.dataset.usersFilter;
    button.classList.toggle('is-active', key === filter);
    button.setAttribute('aria-pressed', String(key === filter));
    const count = button.querySelector('em');
    if (count) count.textContent = String(counts[key] || 0);
  });
  AppShell.refreshIcons();
}

function setFeedback(message = '', tone = '') {
  const feedback = $('usersFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.tone = tone;
}

async function load() {
  const list = $('usersList');
  if (list) list.innerHTML = '<div class="users-loading"><span class="loading-spinner"></span>Carregando usuários...</div>';
  setFeedback();
  try {
    const payload = await UserAccess.listUsers();
    users = payload.users || [];
    render();
  } catch (error) {
    if (list) list.innerHTML = `<div class="ui-empty-state users-empty"><i data-lucide="triangle-alert"></i><strong>Não foi possível carregar</strong><p>${escapeHtml(error.message)}</p><button class="btn btn-primary" id="usersRetryBtn">Tentar novamente</button></div>`;
    $('usersRetryBtn')?.addEventListener('click', load);
    AppShell.refreshIcons();
  }
}

async function runAction(action, uid, value) {
  const target = users.find(user => user.uid === uid);
  if (!target || busyUid) return;
  const confirmations = {
    reject: `Rejeitar a solicitação de ${target.displayName}?`,
    suspend: `Suspender o acesso de ${target.displayName}?`,
    role: `Alterar o cargo de ${target.displayName} para ${ROLE_LABELS[value]}?`,
  };
  if (confirmations[action] && !confirm(confirmations[action])) {
    render();
    return;
  }

  busyUid = uid;
  render();
  setFeedback('Salvando alteração...', '');
  try {
    if (action === 'approve') await UserAccess.approve(uid);
    if (action === 'reject') await UserAccess.reject(uid);
    if (action === 'suspend') await UserAccess.suspend(uid);
    if (action === 'reactivate') await UserAccess.reactivate(uid);
    if (action === 'role') await UserAccess.changeRole(uid, value);
    setFeedback('Alteração salva e registrada na auditoria.', 'success');
    await load();
  } catch (error) {
    setFeedback(error.message, 'error');
  } finally {
    busyUid = null;
    render();
  }
}

function bind() {
  $('usersModalCloseBtn')?.addEventListener('click', () => UsersModal.close());
  $('usersCloseBtn')?.addEventListener('click', () => UsersModal.close());
  $('usersRefreshBtn')?.addEventListener('click', load);
  $('usersSearch')?.addEventListener('input', render);
  $('usersFilters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-users-filter]');
    if (!button) return;
    filter = button.dataset.usersFilter;
    render();
  });
  $('usersList')?.addEventListener('click', event => {
    const button = event.target.closest('[data-user-action]');
    if (button) runAction(button.dataset.userAction, button.dataset.uid);
  });
  $('usersList')?.addEventListener('change', event => {
    const select = event.target.closest('[data-user-role]');
    if (select) runAction('role', select.dataset.userRole, select.value);
  });
}

export const UsersModal = {
  open() {
    if (!UserAccess.can('viewUsers') || $('usersModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--prompt';
    overlay.id = 'usersModalOverlay';
    overlay.innerHTML = `<div class="modal modal--users">
      <div class="modal-hdr">
        <span class="modal-title"><i data-lucide="users-round"></i> Usuários e acessos</span>
        <button class="modal-close" id="usersModalCloseBtn" type="button" aria-label="Fechar"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body users-modal-body">
        <div class="users-toolbar">
          <label class="users-search"><i data-lucide="search"></i><span class="sr-only">Buscar usuário</span><input id="usersSearch" type="search" placeholder="Buscar por nome, e-mail ou cargo" autocomplete="off"></label>
          <button class="btn btn-secondary" id="usersRefreshBtn" type="button"><i data-lucide="refresh-cw"></i><span>Atualizar</span></button>
        </div>
        <div class="users-filters" id="usersFilters" aria-label="Filtrar usuários">
          <button class="is-active" data-users-filter="all" aria-pressed="true">Todos <em>0</em></button>
          <button data-users-filter="pending" aria-pressed="false">Pendentes <em>0</em></button>
          <button data-users-filter="active" aria-pressed="false">Ativos <em>0</em></button>
          <button data-users-filter="suspended" aria-pressed="false">Suspensos <em>0</em></button>
          <button data-users-filter="rejected" aria-pressed="false">Rejeitados <em>0</em></button>
        </div>
        <div class="users-table-head" aria-hidden="true"><span>Usuário</span><span>Status</span><span>Cargo</span><span>Ações</span></div>
        <div class="users-list" id="usersList"></div>
      </div>
      <div class="modal-ftr users-modal-footer">
        <span id="usersFeedback" class="users-feedback" role="status" aria-live="polite"></span>
        <button class="btn btn-primary" id="usersCloseBtn" type="button">Fechar</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) this.close(); });
    document.addEventListener('keydown', this._escHandler);
    bind();
    load();
  },

  close() {
    $('usersModalOverlay')?.remove();
    document.removeEventListener('keydown', this._escHandler);
  },

  _escHandler(event) { if (event.key === 'Escape') UsersModal.close(); },
};
