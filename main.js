import { AppState }     from '/state.js';
import { Categories }   from './categories.js';
import { History }      from './history.js';
import { Prompts }      from './prompts.js';
import { SubcatModule } from './subcategories.js';
import { Quota, Logs }  from './quota.js';
import { Pipeline }     from './pipeline.js';

import { SidebarUI, setCategoryModal } from './SidebarUI.js';
import { CategoryModal }  from './CategoryModal.js';
import { PipelineUI }     from './PipelineUI.js';
import { HistoryUI }      from './HistoryUI.js';
import { PromptModal }    from './PromptModal.js';
import { AnalyticsModal, Export } from './AnalyticsModal.js';
import { SubcatModal }    from './SubcatModal.js';
import { ConfigUI, ThemeUI, SidebarToggle } from './ConfigUI.js';

setCategoryModal(CategoryModal);

(async function init() {
  ThemeUI.restore();
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
  HistoryUI.render();
})();

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
document.getElementById('historicoBusca')?.addEventListener('input',   () => HistoryUI.render());
document.getElementById('historicoFiltro')?.addEventListener('change', () => HistoryUI.render());
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
