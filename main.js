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
import { ConfigUI, ThemeUI, SidebarToggle, ConfigModal } from './ConfigUI.js';
import { HistoryModal }  from './HistoryModal.js';
import { ExemplosModal } from './ExemplosModal.js';

// ── Restaura tema imediatamente (evita flash de tema errado) ──
ThemeUI.restore();

// ── Export — copia e baixa os resultados gerados ──────────────
// CORREÇÃO: Export não estava definido em nenhum lugar do código,
// por isso copyFichaBtn, copyConteudoBtn e exportTxtBtn falhavam
// com "Export is not defined". Agora definido aqui, no escopo correto.
const Export = {
  /**
   * Copia o texto de um dos blocos de resultado para a área de transferência.
   * @param {'ficha'|'conteudo'} which
   */
  copy(which) {
    const elId   = which === 'ficha' ? 'fichaOut' : 'conteudoOut';
    const btnId  = which === 'ficha' ? 'copyFichaBtn' : 'copyConteudoBtn';
    const text   = document.getElementById(elId)?.innerText?.trim() || '';

    if (!text) {
      PipelineUI.log('Nada para copiar — execute o pipeline primeiro.', 'w');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = original; }, 1800);
    }).catch(err => {
      PipelineUI.log(`Erro ao copiar: ${err.message}`, 'e');
    });
  },

  /**
   * Baixa a Ficha Técnica Formatada como arquivo .txt
   */
  txt() {
    const text = document.getElementById('fichaOut')?.innerText?.trim() || '';
    if (!text) {
      PipelineUI.log('Nada para exportar — execute o pipeline primeiro.', 'w');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    // Nome do arquivo: primeiras palavras do texto ou fallback
    const slug = text.split('\n')[0].slice(0, 40).trim().replace(/[^a-zA-Z0-9À-ú\s]/g, '').trim().replace(/\s+/g, '_') || 'ficha';
    a.download = `${slug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

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
// Ponte: HistoryModal dispara evento, HistoryUI escuta
document.addEventListener('fastseo:historyRender', () => { HistoryUI.resetPage(); HistoryUI.render(); });

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
document.getElementById('openConfigBtn')?.addEventListener('click',    () => ConfigModal.open());
document.getElementById('openExemplosBtn')?.addEventListener('click',   () => ExemplosModal.open());
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
// apiKey, mistralKey e modelSel agora vivem dentro do ConfigModal
document.getElementById('inputText')?.addEventListener('input',  () => ConfigUI.updateCharCount());
document.getElementById('runBtn')?.addEventListener('click', () => Pipeline.run());

// ── Botões de exportação (CORRIGIDOS: Export agora está definido) ──
document.getElementById('copyFichaBtn')?.addEventListener('click',    () => Export.copy('ficha'));
document.getElementById('copyConteudoBtn')?.addEventListener('click', () => Export.copy('conteudo'));
document.getElementById('exportTxtBtn')?.addEventListener('click',    () => Export.txt());

// ── NOVO: Botão Regenerar — reexecuta só o A3 (Copywriter) ───
// Lê ficha e validação já geradas, chama Pipeline.rerunCopywriter()
// sem consumir cota dos agentes A1 e A2.
document.getElementById('regenConteudoBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('regenConteudoBtn');
  if (!btn) return;

  // Feedback visual durante a geração
  btn.classList.add('regen-loading');
  btn.textContent = 'Gerando...';

  try {
    await Pipeline.rerunCopywriter();
  } finally {
    btn.classList.remove('regen-loading');
    btn.textContent = '↺ Regenerar';
  }
});

document.getElementById('openHistoricoBtn')?.addEventListener('click',  () => HistoryModal.open());
// busca/filtro agora vivem dentro do HistoryModal
// clearHistoricoBtn é dinâmico (dentro do modal) — usar delegação no document
document.addEventListener('click', async e => {
  if (e.target.id === 'clearHistoricoBtn') {
    await History.clear();
    HistoryUI.render();
  }
});
// focus/blur do historicoBusca agora geridos dentro do HistoryModal
