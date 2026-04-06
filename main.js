/**
 * main.js
 * ────────
 * Ponto de entrada da aplicação FastSEO.
 * Orquestra a inicialização de todos os módulos e registra os event listeners.
 *
 * Ordem de inicialização:
 *   1. Tema + Sidebar (UI imediata, sem rede)
 *   2. Keys salvas
 *   3. Listeners em tempo real do Firestore (assíncrono)
 *   4. Quota UI
 *   5. Event listeners do DOM
 */

// ── Módulos de estado e dados ───────────────────────────────
import { AppState }     from './modules/state.js';
import { Categories }   from './modules/categories.js';
import { History }      from './modules/history.js';
import { Prompts }      from './modules/prompts.js';
import { SubcatModule } from './modules/subcategories.js';
import { Quota, Logs }  from './modules/quota.js';
import { Pipeline }     from './modules/pipeline.js';

// ── Componentes de UI ───────────────────────────────────────
import { SidebarUI, setCategoryModal } from './components/SidebarUI.js';
import { CategoryModal }  from './components/CategoryModal.js';
import { PipelineUI }     from './components/PipelineUI.js';
import { HistoryUI }      from './components/HistoryUI.js';
import { PromptModal }    from './components/PromptModal.js';
import { AnalyticsModal, Export } from './components/AnalyticsModal.js';
import { SubcatModal }    from './components/SubcatModal.js';
import { ConfigUI, ThemeUI, SidebarToggle } from './components/ConfigUI.js';

// Resolve dependência circular Sidebar → CategoryModal
setCategoryModal(CategoryModal);

// ─────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────
(async function init() {

  // 1. Tema e estado da sidebar (sem latência de rede)
  ThemeUI.restore();
  SidebarToggle.restore();

  // 2. API keys salvas no localStorage
  ConfigUI.restoreSavedKeys();
  ConfigUI.updateQuotaInfo();
  Quota.updateUI();

  // 3. Listeners em tempo real do Firestore
  //    Cada startSync() abre um onSnapshot e retorna unsubscribe.
  //    A UI é atualizada automaticamente sempre que o Firestore mudar.
  const _unsubCategories   = Categories.startSync();
  const _unsubHistory      = History.startSync();
  const _unsubPrompts      = Prompts.startSync();
  const _unsubSubcategories = SubcatModule.startSync();

  // Garante que as regras padrão existam no Firestore (migração única)
  SubcatModule.migrateDefaultsToFirestore().catch(console.warn);

  // 4. Render inicial da Sidebar
  //    (será re-renderizada pelo onSnapshot assim que o Firestore responder)
  SidebarUI.render();
  HistoryUI.render();

})();

// ─────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────

// ── Header ───────────────────────────────────────────────────
document.getElementById('sidebarToggle')?.addEventListener('click', () => SidebarToggle.toggle());
document.getElementById('themeBtn')?.addEventListener('click',      () => ThemeUI.toggle());
document.getElementById('openPromptsBtn')?.addEventListener('click', () => PromptModal.open());
document.getElementById('openAnalyticsBtn')?.addEventListener('click',() => AnalyticsModal.open());
document.getElementById('openSubcatBtn')?.addEventListener('click',   () => SubcatModal.open());
document.getElementById('resetCotaBtn')?.addEventListener('click', () => {
  Quota.reset();
  PipelineUI.log('Contador local zerado.', 'o');
});

// ── Nova categoria ────────────────────────────────────────────
document.getElementById('addCatBtn')?.addEventListener('click', async () => {
  const nova = await Categories.create();
  AppState.categories.active     = nova.id;
  AppState.categories.editorOpen = true;
  if (!AppState.sidebar.open) SidebarToggle.toggle();
  SidebarUI.render();
  CategoryModal.open(nova.id);
});

// ── Sidebar — clique em categoria ────────────────────────────
document.getElementById('sbContent')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-catid]');
  if (btn) SidebarUI.select(btn.dataset.catid);
});

// ── Configuração ─────────────────────────────────────────────
document.getElementById('apiKey')?.addEventListener('input',    () => ConfigUI.validateGeminiKey());
document.getElementById('mistralKey')?.addEventListener('input', () => ConfigUI.validateMistralKey());
document.getElementById('modelSel')?.addEventListener('change',  () => ConfigUI.updateQuotaInfo());
document.getElementById('inputText')?.addEventListener('input',  () => ConfigUI.updateCharCount());

// ── Pipeline ─────────────────────────────────────────────────
document.getElementById('runBtn')?.addEventListener('click', () => Pipeline.run());
document.getElementById('copyFichaBtn')?.addEventListener('click',   () => Export.copy('ficha'));
document.getElementById('copyConteudoBtn')?.addEventListener('click', () => Export.copy('conteudo'));
document.getElementById('exportTxtBtn')?.addEventListener('click',    () => Export.txt());

// ── Histórico ────────────────────────────────────────────────
document.getElementById('historicoBusca')?.addEventListener('input',   () => HistoryUI.render());
document.getElementById('historicoFiltro')?.addEventListener('change', () => HistoryUI.render());
document.getElementById('clearHistoricoBtn')?.addEventListener('click', async () => {
  await History.clear();
  HistoryUI.render();
});

// Estilos hover do botão de limpar histórico
document.getElementById('clearHistoricoBtn')?.addEventListener('mouseover', e => e.target.style.color = 'var(--color-danger)');
document.getElementById('clearHistoricoBtn')?.addEventListener('mouseout',  e => e.target.style.color = 'var(--color-text-muted)');

// Estilos focus/blur do campo de busca
document.getElementById('historicoBusca')?.addEventListener('focus', e => {
  e.target.style.borderColor = 'var(--color-accent)';
  e.target.style.boxShadow   = '0 0 0 3px var(--color-accent-glow)';
});
document.getElementById('historicoBusca')?.addEventListener('blur', e => {
  e.target.style.borderColor = 'var(--color-border)';
  e.target.style.boxShadow   = 'none';
});
