import { Auth }         from './services/auth.js';
import { Categories }   from './modules/categories.js';
import { History }      from './modules/history.js';
import { Prompts }      from './modules/prompts.js';
import { SubcatModule } from './modules/subcategories.js';
import { Quota }        from './modules/quota.js';
import { Pipeline }     from './modules/pipeline.js';

import { SidebarUI }      from './components/SidebarUI.js';
import { PipelineUI }     from './components/PipelineUI.js';
import { HistoryUI }      from './components/HistoryUI.js';
import { ConfigModal, ConfigUI, ThemeModal } from './components/ConfigUI.js';

// ── Restaura tema imediatamente (evita flash de tema errado) ──
ThemeModal.restore();

// ── Export — copia e baixa os resultados gerados ──────────────
// CORREÇÃO: Export não estava definido em nenhum lugar do código,
// por isso copyFichaBtn, copyConteudoBtn e exportTxtBtn falhavam
// com "Export is not defined". Agora definido aqui, no escopo correto.
const Export = {
  /**
   * Copia o texto de um dos blocos de resultado para a área de transferência.
   * @param {'ficha'|'conteudo'} which
   */
  async copy(which) {
    const elId   = which === 'ficha' ? 'fichaOut' : 'conteudoOut';
    const btnId  = which === 'ficha' ? 'copyFichaBtn' : 'copyConteudoBtn';
    const text   = document.getElementById(elId)?.innerText?.trim() || '';

    if (!text || text === 'Conteudo comercial ainda nao gerado.') {
      PipelineUI.toast('Nada para copiar ainda.', 'warn');
      PipelineUI.log('Nada para copiar — execute o pipeline primeiro.', 'w');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = original; }, 1800);
      PipelineUI.toast('Resultado copiado.', 'ok');
    }).catch(err => {
      PipelineUI.log(`Erro ao copiar: ${err.message}`, 'e');
      PipelineUI.toast('Nao foi possivel copiar.', 'error');
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
    PipelineUI.toast('Arquivo .txt baixado.', 'ok');
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
document.addEventListener('fastseo:catsChanged', () => {
  if (!document.getElementById('categoriasModalOverlay')) return;
  import('./components/CategoriasModal.js').then(({ CategoriasModal }) => CategoriasModal.onCatsChanged());
});

async function init() {
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateCharCount();
  ConfigUI.updateQuotaInfo();
  ThemeModal.restoreDom();
  Quota.updateUI();
  const _unsubCategories    = Categories.startSync();
  const _unsubHistory       = History.startSync();
  const _unsubPrompts       = Prompts.startSync();
  const _unsubSubcategories = SubcatModule.startSync();
  SubcatModule.migrateDefaultsToFirestore().catch(console.warn);
  SidebarUI.render();
  updateRunReadiness();
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
document.getElementById('themeBtn')?.addEventListener('click', async () => {
  ThemeModal.restoreDom();
  ThemeModal.open();
});
document.getElementById('openPromptsBtn')?.addEventListener('click', async () => {
  const { PromptModal } = await import('./components/PromptModal.js');
  PromptModal.open();
});
document.getElementById('openAnalyticsBtn')?.addEventListener('click', async () => {
  const { AnalyticsModal } = await import('./components/AnalyticsModal.js');
  AnalyticsModal.open();
});
document.getElementById('openSubcatBtn')?.addEventListener('click', async () => {
  const { SubcatModal } = await import('./components/SubcatModal.js');
  SubcatModal.open();
});
document.getElementById('openConfigBtn')?.addEventListener('click', async () => {
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateQuotaInfo();
  ThemeModal.restoreDom();
  ConfigModal.open();
});
document.getElementById('openCategoriasBtn')?.addEventListener('click', async () => {
  const { CategoriasModal } = await import('./components/CategoriasModal.js');
  CategoriasModal.open();
});
document.getElementById('resetCotaBtn')?.addEventListener('click', () => {
  Quota.reset();
  PipelineUI.log('Contador local zerado.', 'o');
});
// addCatBtn agora vive dentro do CategoriasModal
// sbContent agora é oculto — seleção via CategoriasModal
// apiKey, mistralKey e modelSel agora vivem dentro do ConfigModal
function updateRunReadiness() {
  const input = document.getElementById('inputText')?.value?.trim() || '';
  const btn = document.getElementById('runBtn');
  if (!btn) return;
  const ready = input.length > 0;
  btn.disabled = !ready;
  btn.title = ready ? 'Processar ficha tecnica' : 'Cole os dados do produto para processar';
}

document.getElementById('inputText')?.addEventListener('input',  () => {
  ConfigUI.updateCharCount();
  updateRunReadiness();
});

// ── Drag & drop de PDF no textarea ────────────────────────────
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
    const { PDFReader } = await import('./modules/PDFReader.js');
    await PDFReader.drop(file);
  }
});
document.getElementById('runBtn')?.addEventListener('click', () => Pipeline.run());
document.getElementById('pdfBtn')?.addEventListener('click', async () => {
  const { PDFReader } = await import('./modules/PDFReader.js');
  PDFReader.open();
});

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

document.getElementById('openHistoricoBtn')?.addEventListener('click', async () => {
  const { HistoryModal } = await import('./components/HistoryModal.js');
  HistoryModal.open();
});
// busca/filtro agora vivem dentro do HistoryModal
// clearHistoricoBtn é dinâmico (dentro do modal) — usar delegação no document
document.addEventListener('click', async e => {
  if (e.target.id === 'clearHistoricoBtn') {
    const ok = confirm('Limpar todo o historico salvo? Essa acao nao pode ser desfeita.');
    if (!ok) return;
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Limpando...';
    try {
      await History.clear();
      HistoryUI.render();
      PipelineUI.toast('Historico limpo.', 'ok');
    } catch (err) {
      PipelineUI.log(`Erro ao limpar historico: ${err.message}`, 'e');
      PipelineUI.toast('Nao foi possivel limpar o historico.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Limpar tudo';
    }
  }
});
// focus/blur do historicoBusca agora geridos dentro do HistoryModal

// ── Gaveta lateral (botões secundários) ───────────────────────
const _drawerBtn     = document.getElementById('hdrMoreBtn');
const _drawer        = document.getElementById('sideDrawer');
const _drawerOverlay = document.getElementById('sideDrawerOverlay');

function _openDrawer() {
  if (!_drawer) return;
  _drawer.classList.add('is-open');
  _drawerOverlay.classList.add('is-open');
}
function _closeDrawer() {
  if (!_drawer) return;
  _drawer.classList.remove('is-open');
  _drawerOverlay.classList.remove('is-open');
}

_drawerBtn?.addEventListener('click', _openDrawer);
_drawerOverlay?.addEventListener('click', _closeDrawer);
document.getElementById('sideDrawerClose')?.addEventListener('click', _closeDrawer);

// Fecha ao clicar em qualquer item da gaveta
document.getElementById('sideDrawer')?.querySelectorAll('.side-drawer-item').forEach(item => {
  item.addEventListener('click', _closeDrawer);
});
