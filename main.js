import { Auth }         from './auth.js';
import { AppState }     from './state.js';
import { Categories }   from './categories.js';
import { History }      from './history.js';
import { Prompts }      from './prompts.js';
import { SubcatModule } from './subcategories.js';
import { Quota, Logs }  from './quota.js';
import { Pipeline }     from './pipeline.js';

import { SidebarUI }      from './SidebarUI.js';
import { CategoryModal }  from './CategoryModal.js';
import { PipelineUI }     from './PipelineUI.js';
import { HistoryUI }      from './HistoryUI.js';
import { PromptModal }    from './PromptModal.js';
import { AnalyticsModal } from './AnalyticsModal.js';
import { SubcatModal }    from './SubcatModal.js';
import { ConfigUI, ThemeUI, SidebarToggle } from './ConfigUI.js';

// ── Restaura tema imediatamente (evita flash de tema errado) ──
ThemeUI.restore();

// ── Tela de login ─────────────────────────────────────────────
function showLogin() {
  document.getElementById('appLoading').style.display   = 'none';
  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('appHeader').style.display    = 'none';
  document.getElementById('appLayout').style.display    = 'none';
}

function showApp(user) {
  document.getElementById('appLoading').style.display   = 'none';
  document.getElementById('loginScreen').style.display  = 'none';
  document.getElementById('appHeader').style.display    = '';
  document.getElementById('appLayout').style.display    = '';

  // Mostra nome do usuário no header
  const nameEl = document.getElementById('userDisplayName');
  if (nameEl) nameEl.textContent = user.displayName || user.email;
}

// ── Inicialização do app (só roda uma vez após login) ─────────
async function init() {
  SidebarToggle.restore();
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateQuotaInfo();
  Quota.updateUI();
  const _unsubCategories    = Categories.startSync();
  const _unsubHistory       = History.startSync();
  const _unsubPrompts       = Prompts.startSync();
  const _unsubSubcategories = SubcatModule.startSync();
  SubcatModule.migrateDefaultsToFirestore().catch(console.warn);
  SidebarUI.render();
  // Painel começa fechado — History.startSync() atualiza só o badge.
  // A lista é renderizada apenas quando o usuário abrir o painel.
}

// ── Observador de autenticação ────────────────────────────────
let appStarted = false;

Auth.onChange(user => {
  if (user) {
    showApp(user);
    if (!appStarted) {
      appStarted = true;
      init();
    }
  } else {
    showLogin();
  }
});

// ── Botão de login ────────────────────────────────────────────
const _loginBtn     = document.getElementById('loginGoogleBtn');
const _loginBtnHTML = _loginBtn?.innerHTML; // guarda o HTML original com o ícone

_loginBtn?.addEventListener('click', async () => {
  const btn = document.getElementById('loginGoogleBtn');
  const err = document.getElementById('loginError');
  btn.disabled   = true;
  btn.innerHTML  = 'Entrando...';
  err.textContent = '';

  try {
    await Auth.login();
  } catch (e) {
    btn.disabled  = false;
    btn.innerHTML = _loginBtnHTML; // restaura ícone + texto originais
    err.textContent = e.message;
  }
});

// ── Botão de logout ───────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => Auth.logout());

// ── Eventos do app ────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => SidebarToggle.toggle());
document.getElementById('themeBtn')?.addEventListener('click',       () => ThemeUI.toggle());
document.getElementById('openPromptsBtn')?.addEventListener('click',  () => PromptModal.open());
document.getElementById('openAnalyticsBtn')?.addEventListener('click',() => AnalyticsModal.open());
document.getElementById('openSubcatBtn')?.addEventListener('click',   () => SubcatModal.open());
document.getElementById('resetCotaBtn')?.addEventListener('click', () => {
  Quota.reset();
  PipelineUI.log('Contador local zerado.', 'o');
});
document.getElementById('addCatBtn')?.addEventListener('click', async () => {
  const nova = await Categories.create();
  AppState.categories.active     = nova.id;
  AppState.categories.editorOpen = true;
  if (!AppState.sidebar.open) SidebarToggle.toggle();
  SidebarUI.render();
  CategoryModal.open(nova.id);
});
document.getElementById('sbContent')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-catid]');
  if (btn) SidebarUI.select(btn.dataset.catid);
});
document.getElementById('apiKey')?.addEventListener('input',    () => ConfigUI.validateGeminiKey());
document.getElementById('mistralKey')?.addEventListener('input', () => ConfigUI.validateMistralKey());
document.getElementById('modelSel')?.addEventListener('change',  () => ConfigUI.updateQuotaInfo());
document.getElementById('inputText')?.addEventListener('input',  () => ConfigUI.updateCharCount());
document.getElementById('runBtn')?.addEventListener('click', () => Pipeline.run());
document.getElementById('copyFichaBtn')?.addEventListener('click',    () => Export.copy('ficha'));
document.getElementById('copyConteudoBtn')?.addEventListener('click', () => Export.copy('conteudo'));
document.getElementById('exportTxtBtn')?.addEventListener('click',    () => Export.txt());
document.getElementById('historicoToggleBtn')?.addEventListener('click', () => HistoryUI.toggle());
document.getElementById('historicoBusca')?.addEventListener('input',   () => { HistoryUI.resetPage(); HistoryUI.render(); });
document.getElementById('historicoFiltro')?.addEventListener('change', () => { HistoryUI.resetPage(); HistoryUI.render(); });
document.getElementById('clearHistoricoBtn')?.addEventListener('click', async () => {
  await History.clear();
  HistoryUI.render();
});
document.getElementById('clearHistoricoBtn')?.addEventListener('mouseover', e => e.target.style.color = 'var(--color-danger)');
document.getElementById('clearHistoricoBtn')?.addEventListener('mouseout',  e => e.target.style.color = 'var(--color-text-muted)');
document.getElementById('historicoBusca')?.addEventListener('focus', e => {
  e.target.style.borderColor = 'var(--color-accent)';
  e.target.style.boxShadow   = '0 0 0 3px var(--color-accent-glow)';
});
document.getElementById('historicoBusca')?.addEventListener('blur', e => {
  e.target.style.borderColor = 'var(--color-border)';
  e.target.style.boxShadow   = 'none';
});
