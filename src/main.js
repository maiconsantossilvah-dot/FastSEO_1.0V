import { Auth } from './services/auth.js';
import { UserAccess } from './services/userAccess.js';
import { UsageAnalytics } from './services/usageAnalytics.js';
import { Categories } from './modules/categories.js';
import { History } from './modules/history.js';
import { Prompts } from './modules/prompts.js';
import { SubcatModule } from './modules/subcategories.js';
import { Pipeline } from './modules/pipeline.js';
import { FAQCreator } from './modules/faqCreator.js';
import { DataCompiler } from './modules/dataCompiler.js';
import { InternalDocs } from './modules/internalDocs.js';
import { PipelineUI } from './components/PipelineUI.js';
import { HistoryUI } from './components/HistoryUI.js';
import { ConfigModal, ConfigUI } from './components/ConfigUI.js';
import { AppShell } from './components/AppShell.js';
import { AnalyticsModal } from './components/AnalyticsModal.js';
import { CategoriasModal } from './components/CategoriasModal.js';
import { HistoryModal } from './components/HistoryModal.js';
import { PromptModal } from './components/PromptModal.js';
import { SubcatModal } from './components/SubcatModal.js';
import { UsersModal } from './components/UsersModal.js';
import { buildExportWithFaqPrompt } from './modules/exportPrompt.js';
import { createAiRuntime } from './ai/createAiRuntime.js';
import { systemClock } from './ai/clock.js';
import { configureAiRuntime } from './services/api.js';
import { ApiSettings } from './services/apiSettings.js';
import { GEMINI_DEFAULT_MODEL, MISTRAL_MODEL } from './config.js';
import { isValidGeminiKey } from './utils/apiKeys.js';
import { runViewTransition } from './utils/viewTransitions.js';

// Composition root do runtime: estado de fila pertence a esta instância da aba.
configureAiRuntime(createAiRuntime({
  fetch: (...args) => globalThis.fetch(...args),
  clock: systemClock,
  getGeminiKeys: () => ApiSettings.getGeminiKeys(),
  getMistralKeys: () => ApiSettings.getMistralKeys(),
  getGeminiModel: () => ApiSettings.getModel() || GEMINI_DEFAULT_MODEL,
  mistralModel: MISTRAL_MODEL,
  validateGeminiKey: isValidGeminiKey,
}));

// ── Export — ações de clipboard e download dos resultados ────
const Export = {
  /**
   * Copia o texto de um dos blocos de resultado para a área de transferência.
   * @param {'ficha'|'conteudo'} which
   */
  async copy(which) {
    const elId = which === 'ficha' ? 'fichaOut' : 'conteudoOut';
    const btnId = which === 'ficha' ? 'copyFichaBtn' : 'copyConteudoBtn';
    const text = document.getElementById(elId)?.innerText?.trim() || '';

    if (!text || text === 'Conteúdo comercial ainda não gerado.') {
      PipelineUI.toast('Nada para copiar ainda.', 'warn');
      PipelineUI.log('Nada para copiar — execute o pipeline primeiro.', 'w');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const original = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" aria-hidden="true"></i><span>Copiado</span>';
      AppShell.refreshIcons();
      setTimeout(() => { btn.innerHTML = original; AppShell.refreshIcons(); }, 1800);
      PipelineUI.toast('Resultado copiado.', 'ok');
    }).catch(err => {
      PipelineUI.log(`Erro ao copiar: ${err.message}`, 'e');
      PipelineUI.toast('Não foi possível copiar.', 'error');
    });
  },

  async copyFichaComTexto() {
    const ficha = document.getElementById('fichaOut')?.innerText?.trim() || '';

    if (!ficha) {
      PipelineUI.toast('Nada para copiar ainda.', 'warn');
      PipelineUI.log('Nada para copiar — execute o pipeline primeiro.', 'w');
      return;
    }

    const textoFinal = buildExportWithFaqPrompt(ficha);

    navigator.clipboard.writeText(textoFinal).then(() => {
      const btn = document.getElementById('copyFichaComTextoBtn');
      if (!btn) return;

      const original = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" aria-hidden="true"></i><span>Copiado</span>';
      AppShell.refreshIcons();
      setTimeout(() => { btn.innerHTML = original; AppShell.refreshIcons(); }, 1800);

      PipelineUI.toast('Ficha com texto copiada.', 'ok');
    }).catch(err => {
      PipelineUI.log(`Erro ao copiar: ${err.message}`, 'e');
      PipelineUI.toast('Não foi possível copiar.', 'error');
    });
  },

  /**
   * Baixa a Ficha Técnica Formatada como arquivo .txt
   */
  txt() {
    const text = document.getElementById('fichaOut')?.innerText?.trim() || '';
    if (!text) {
      PipelineUI.toast('Nada para exportar ainda.', 'warn');
      PipelineUI.log('Nada para exportar — execute o pipeline primeiro.', 'w');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Nome do arquivo: primeiras palavras do texto ou fallback
    const slug = text.split('\n')[0].slice(0, 40).trim().replace(/[^a-zA-Z0-9À-ú\s]/g, '').trim().replace(/\s+/g, '_') || 'ficha';
    a.download = `${slug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    PipelineUI.toast('Arquivo .txt baixado.', 'ok');
  },
};

// ── Tela de login ─────────────────────────────────────────────
function showLogin() {
  document.getElementById('appLoading').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('accessScreen').style.display = 'none';
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('appLayout').style.display = 'none';
  if (_loginBtn) {
    _loginBtn.disabled = false;
    _loginBtn.innerHTML = _loginBtnHTML;
  }
}

function showApp(user) {
  document.getElementById('appLoading').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('accessScreen').style.display = 'none';
  document.getElementById('appHeader').style.display = '';
  document.getElementById('appLayout').style.display = '';

  // Mostra nome do usuário no header
  const nameEl = document.getElementById('userDisplayName');
  if (nameEl) nameEl.textContent = user.displayName || user.email;
}

const ACCESS_COPY = {
  pending: {
    icon: 'clock-3',
    title: 'Solicitação em análise',
    message: 'A solicitação de acesso está aguardando aprovação. Assim que um administrador aprovar, a entrada será liberada como espectador.',
  },
  rejected: {
    icon: 'circle-x',
    title: 'Solicitação não aprovada',
    message: 'Esta solicitação de acesso foi rejeitada. Entre em contato com um administrador do FastSEO se precisar de uma nova análise.',
  },
  suspended: {
    icon: 'circle-pause',
    title: 'Acesso suspenso',
    message: 'Seu acesso ao FastSEO está temporariamente suspenso. Entre em contato com um administrador para solicitar a reativação.',
  },
  error: {
    icon: 'cloud-off',
    title: 'Não foi possível validar o acesso',
    message: 'O serviço de usuários não respondeu. Inicie ou verifique o backend e tente novamente.',
  },
};

function showAccessState(firebaseUser, status = 'pending', detail = '') {
  const copy = ACCESS_COPY[status] || ACCESS_COPY.error;
  document.getElementById('appLoading').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('accessScreen').style.display = 'flex';
  document.getElementById('appHeader').style.display = 'none';
  document.getElementById('appLayout').style.display = 'none';
  document.getElementById('accessIcon').innerHTML = `<i data-lucide="${copy.icon}" aria-hidden="true"></i>`;
  document.getElementById('accessTitle').textContent = copy.title;
  document.getElementById('accessMessage').textContent = detail || copy.message;
  document.getElementById('accessDisplayName').textContent = firebaseUser?.displayName || 'Conta Google';
  document.getElementById('accessEmail').textContent = firebaseUser?.email || '';
  AppShell.refreshIcons();
}

function applyAccessExperience() {
  const { user, permissions } = UserAccess.current();
  const roleLabels = { owner: 'Proprietário', admin: 'Administrador', collaborator: 'Colaborador', viewer: 'Espectador' };
  const roleEl = document.getElementById('userRoleLabel');
  if (roleEl) roleEl.textContent = roleLabels[user?.role] || '';
  document.body.classList.toggle('is-read-only', permissions?.editContent === false);
  document.getElementById('openUsersBtn')?.toggleAttribute('hidden', !permissions?.viewUsers);
  document.getElementById('openPromptsBtn')?.toggleAttribute('hidden', !permissions?.viewPrompts);
  document.getElementById('openAnalyticsBtn')?.toggleAttribute('hidden', !permissions?.viewUsageAnalytics);
  UserAccess.enforceReadOnly(document);
}

// ── Inicialização do app (só roda uma vez após login) ─────────
// Ponte: HistoryModal dispara evento, HistoryUI escuta
document.addEventListener('fastseo:historyRender', () => { HistoryUI.resetPage(); HistoryUI.render(); });
document.addEventListener('fastseo:catsChanged', () => {
  scheduleInputCategoryHint(100);
  if (document.getElementById('categoriasModalOverlay')) {
    CategoriasModal.onCatsChanged();
  }
});

let appCleanups = [];
async function init() {
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateCharCount();
  ConfigUI.updateQuotaInfo();
  FAQCreator.init();
  UsageAnalytics.initialize();
  appCleanups = [
    Categories.startSync(),
    History.startSync(),
    Prompts.startSync(),
    SubcatModule.startSync(),
  ].filter(cleanup => typeof cleanup === 'function');
  updateRunReadiness();
  // Painel começa fechado — History.startSync() atualiza só o badge.
  // A lista é renderizada apenas quando o usuário abrir o painel.
}

// ── Observador de autenticação ────────────────────────────────
let appStarted = false;
let authRevision = 0;

async function handleAuthenticatedUser(firebaseUser) {
  const revision = ++authRevision;
  document.getElementById('appLoading').style.display = 'flex';
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('accessScreen').style.display = 'none';
  try {
    const access = await UserAccess.initialize();
    if (revision !== authRevision) return;
    if (access.user?.status !== 'active' || !access.user?.role) {
      showAccessState(firebaseUser, access.user?.status || 'pending');
      return;
    }
    showApp(firebaseUser);
    applyAccessExperience();
    if (!appStarted) {
      appStarted = true;
      await init();
      UserAccess.enforceReadOnly(document);
    }
  } catch (error) {
    if (revision !== authRevision) return;
    showAccessState(firebaseUser, 'error', error.message);
  }
}

Auth.onChange(user => {
  if (user) {
    handleAuthenticatedUser(user);
    return;
  }
  authRevision += 1;
  UserAccess.clear();
  document.body.classList.remove('is-read-only');
  appCleanups.forEach(cleanup => cleanup());
  appCleanups = [];
  appStarted = false;
  showLogin();
});

// ── Botão de login ────────────────────────────────────────────
const _loginBtn = document.getElementById('loginGoogleBtn');
const _loginBtnHTML = _loginBtn?.innerHTML; // guarda o HTML original com o ícone

_loginBtn?.addEventListener('click', async () => {
  const btn = document.getElementById('loginGoogleBtn');
  const err = document.getElementById('loginError');
  btn.disabled = true;
  btn.innerHTML = 'Entrando...';
  err.textContent = '';

  try {
    await Auth.login();
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = _loginBtnHTML; // restaura ícone + texto originais
    err.textContent = e.message;
  }
});

// ── Botão de logout ───────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());
document.getElementById('accessLogoutBtn')?.addEventListener('click', () => Auth.logout());
document.getElementById('accessRetryBtn')?.addEventListener('click', () => {
  const user = Auth.currentUser();
  if (user) handleAuthenticatedUser(user);
});

// ── Botão de tema claro/escuro ────────────────────────────────
const themeBtn = document.getElementById('themeToggleBtn');

function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem('fastseo_theme_mode', mode); }
  catch { /* Tema continua aplicado durante a sessão atual. */ }

  if (themeBtn) {
    AppShell.renderThemeIcon(mode);
  }
}

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('fastseo_theme_mode') || 'dark'; }
catch { /* Mantém o tema padrão quando o armazenamento está bloqueado. */ }
setTheme(savedTheme);

themeBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'light' ? 'dark' : 'light');
});

// ── Eventos do app ────────────────────────────────────────────
function showMainView(view, options = {}) {
  const ficha = document.getElementById('fastseoWorkspace');
  const faq = document.getElementById('faqWorkspace');
  const compiler = document.getElementById('compilerWorkspace');
  const docs = document.getElementById('docsWorkspace');

  const fichaBtn = document.getElementById('showFichaViewBtn');
  const faqBtn = document.getElementById('showFaqViewBtn');
  const compilerBtn = document.getElementById('showCompilerViewBtn');
  const docsBtn = document.getElementById('showDocsViewBtn');

  const isFicha = view === 'ficha';
  const isFaq = view === 'faq';
  const isCompiler = view === 'compiler';
  const isDocs = view === 'docs';

  const swapView = () => {
    if (ficha) ficha.hidden = !isFicha;
    if (faq) faq.hidden = !isFaq;
    if (compiler) compiler.hidden = !isCompiler;
    if (docs) docs.hidden = !isDocs;

    fichaBtn?.classList.toggle('active', isFicha);
    faqBtn?.classList.toggle('active', isFaq);
    compilerBtn?.classList.toggle('active', isCompiler);
    docsBtn?.classList.toggle('active', isDocs);

    fichaBtn?.toggleAttribute('aria-current', isFicha);
    faqBtn?.toggleAttribute('aria-current', isFaq);
    compilerBtn?.toggleAttribute('aria-current', isCompiler);
    docsBtn?.toggleAttribute('aria-current', isDocs);
  };

  runViewTransition(swapView, { animate: options.animate !== false });
  try {
    history.replaceState(null, '', `#${view}`);
    localStorage.setItem('fastseo_current_view', view);
  } catch { /* A navegação funciona mesmo sem persistência local. */ }
}

document.getElementById('showFichaViewBtn')?.addEventListener('click', () => showMainView('ficha'));
document.getElementById('showFaqViewBtn')?.addEventListener('click', () => {
  FAQCreator.init();
  showMainView('faq');
});
document.getElementById('showCompilerViewBtn')?.addEventListener('click', () => {
  DataCompiler.init();
  showMainView('compiler');
});
document.getElementById('showDocsViewBtn')?.addEventListener('click', () => {
  InternalDocs.init();
  showMainView('docs');
});

document.getElementById('openPromptsBtn')?.addEventListener('click', () => {
  if (UserAccess.can('viewPrompts')) PromptModal.open();
});
document.getElementById('openUsersBtn')?.addEventListener('click', () => UsersModal.open());
document.getElementById('openAnalyticsBtn')?.addEventListener('click', () => {
  if (UserAccess.can('viewUsageAnalytics')) AnalyticsModal.open();
});
document.getElementById('openSubcatBtn')?.addEventListener('click', () => SubcatModal.open());
document.getElementById('openConfigBtn')?.addEventListener('click', async () => {
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateQuotaInfo();
  ConfigModal.open();
});
document.getElementById('openCategoriasBtn')?.addEventListener('click', () => {
  CategoriasModal.open();

});
function updateRunReadiness() {
  const input = document.getElementById('inputText')?.value?.trim() || '';
  const btn = document.getElementById('runBtn');
  if (!btn) return;

  // Evita iniciar o pipeline sem dados brutos no campo principal.
  const ready = input.length > 0 && UserAccess.can('editContent');
  btn.disabled = !ready;
  btn.title = ready ? 'Processar ficha técnica' : 'Cole os dados do produto para processar';
}

let categoryHintTimer = null;
let categoryHintRevision = 0;

function scheduleInputCategoryHint(delay = 500) {
  clearTimeout(categoryHintTimer);
  categoryHintTimer = setTimeout(() => { void updateInputCategoryHint(); }, delay);
}

async function updateInputCategoryHint() {
  const revision = ++categoryHintRevision;
  const input = document.getElementById('inputText')?.value?.trim() || '';
  const hint = document.getElementById('inputCategoryHint');
  if (!hint) return;

  if (input.length < 3) {
    hint.hidden = true;
    hint.textContent = '';
    return;
  }

  let resolution;
  try {
    resolution = await Categories.resolveDetailed(input);
  } catch {
    if (revision === categoryHintRevision) {
      hint.hidden = true;
      hint.textContent = '';
    }
    return;
  }
  if (revision !== categoryHintRevision) return;
  const matchedCats = resolution.categories;
  const subcatRule = resolution.titleRule;

  if (!matchedCats.length && !subcatRule) {
    hint.hidden = true;
    hint.textContent = '';
    return;
  }

  const catText = matchedCats.length
    ? `Categoria cadastrada: ${matchedCats.map(c => c.nome).join(', ')}`
    : 'Categoria cadastrada: não encontrada';

  const subcatText = subcatRule ? ` • Padrão: ${subcatRule.nome}` : '';

  hint.hidden = false;
  hint.textContent = `${catText}${subcatText}`;
}

document.getElementById('inputText')?.addEventListener('input', () => {
  ConfigUI.updateCharCount();
  updateRunReadiness();
  scheduleInputCategoryHint();
});

// ── Drag & drop de arquivos no textarea ────────────────────────────
const _ta = document.getElementById('inputText');
_ta?.addEventListener('dragover', e => {
  e.preventDefault();
  _ta.style.borderColor = 'var(--color-accent)';
});
_ta?.addEventListener('dragleave', () => {
  _ta.style.borderColor = '';
});
_ta?.addEventListener('drop', async e => {
  e.preventDefault();
  _ta.style.borderColor = '';
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    const { FileImporter } = await import('./modules/FileImporter.js');
    await FileImporter.importFile(file);
  }
});
document.getElementById('runBtn')?.addEventListener('click', () => Pipeline.run());
document.getElementById('importFileBtn')?.addEventListener('click', async () => {
  const { FileImporter } = await import('./modules/FileImporter.js');
  FileImporter.open();
});

// ── Botões de exportação ─────────────────────────────────────
document.getElementById('copyFichaBtn')?.addEventListener('click', () => Export.copy('ficha'));
document.getElementById('copyConteudoBtn')?.addEventListener('click', () => Export.copy('conteudo'));
document.getElementById('exportTxtBtn')?.addEventListener('click', () => Export.txt());
document.getElementById('copyFichaComTextoBtn')?.addEventListener('click', () => Export.copyFichaComTexto());
// Regenerar reexecuta somente o A3, sem consumir A1 e A2.
document.getElementById('regenConteudoBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('regenConteudoBtn');
  if (!btn) return;

  // Feedback visual durante a geração
  btn.classList.add('regen-loading');
  btn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span><span>Gerando...</span>';

  try {
    await Pipeline.rerunCopywriter();
  } finally {
    btn.classList.remove('regen-loading');
    btn.innerHTML = '<i data-lucide="refresh-cw" aria-hidden="true"></i><span>Regenerar</span>';
    AppShell.refreshIcons();
  }
});

document.getElementById('openHistoricoBtn')?.addEventListener('click', () => HistoryModal.open());
// busca/filtro agora vivem dentro do HistoryModal
// clearHistoricoBtn é dinâmico (dentro do modal) — usar delegação no document
document.addEventListener('click', async e => {
  if (e.target.id === 'clearHistoricoBtn') {
    const ok = confirm('Limpar todo o histórico salvo? Essa ação não pode ser desfeita.');
    if (!ok) return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Limpando...';
    try {
      await History.clear();
      HistoryUI.render();
      PipelineUI.toast('Histórico limpo.', 'ok');
    } catch (err) {
      PipelineUI.log(`Erro ao limpar histórico: ${err.message}`, 'e');
      PipelineUI.toast('Não foi possível limpar o histórico.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Limpar tudo';
    }
  }
});
// focus/blur do historicoBusca agora geridos dentro do HistoryModal

// Shell visual, navegação responsiva, Lucide, atalhos e rascunhos.
AppShell.init();

let initialView = location.hash.slice(1) || 'ficha';
try { initialView = location.hash.slice(1) || localStorage.getItem('fastseo_current_view') || 'ficha'; }
catch { /* Usa a visualização padrão. */ }
const initialViewButton = {
  ficha: 'showFichaViewBtn',
  faq: 'showFaqViewBtn',
  compiler: 'showCompilerViewBtn',
  docs: 'showDocsViewBtn',
}[initialView];
if (initialViewButton && initialView !== 'ficha') {
  // A restauração acontece enquanto o documento ainda está estabilizando.
  // Inicializa a ferramenta selecionada, mas não tenta capturar uma transição.
  if (initialView === 'faq') FAQCreator.init();
  if (initialView === 'compiler') DataCompiler.init();
  if (initialView === 'docs') InternalDocs.init();
  showMainView(initialView, { animate: false });
}

