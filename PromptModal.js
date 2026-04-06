/**
 * components/PromptModal.js
 */
import { AppState }          from './state.js';
import { Prompts, PROMPTS_DEFAULT, PROMPT_LABELS } from './prompts.js';

const $ = id => document.getElementById(id);

export const PromptModal = {
  open() {
    if ($('promptModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--prompt';
    overlay.id = 'promptModalOverlay';
    overlay.innerHTML = `
      <div class="modal modal--lg">
        <div class="modal-hdr">
          <span class="modal-title">✏️ Editar Prompts dos Agentes</span>
          <button class="modal-close" id="promptModalCloseBtn">✕</button>
        </div>
        <div class="modal-body" style="gap:14px">
          <div class="prompt-tab-row" id="promptTabs"></div>
          <div style="font-size:11px;color:var(--color-text-muted)">Edite o prompt do agente selecionado. Alterações são salvas automaticamente. <span style="color:var(--color-warn)">Prompts modificados aparecem com ●</span></div>
          <textarea class="prompt-textarea" id="promptTextarea"></textarea>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-secondary" id="promptRestoreBtn">Restaurar padrão</button>
          <span class="modal-saved" id="promptSavedMsg">✓ Salvo</span>
          <button class="btn btn-primary" id="promptCloseBtn">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    $('promptModalCloseBtn').addEventListener('click', () => this.close());
    $('promptCloseBtn').addEventListener('click',      () => this.close());
    $('promptRestoreBtn').addEventListener('click',    () => this._restore());
    $('promptTextarea').addEventListener('input',      () => this._onInput());
    document.addEventListener('keydown', this._escHandler);
    this._renderTabs();
    this._selectTab(AppState.prompts.activeTab);
  },

  close() {
    clearTimeout(AppState.prompts.saveTimer);
    $('promptModalOverlay')?.remove();
    document.removeEventListener('keydown', this._escHandler);
  },

  _escHandler(e) { if (e.key === 'Escape') PromptModal.close(); },

  _renderTabs() {
    const row = $('promptTabs');
    if (!row) return;
    row.innerHTML = Object.entries(PROMPT_LABELS).map(([k, lbl]) => {
      const dot = Prompts.isCustom(k) ? ' ●' : '';
      return `<button class="prompt-tab${k === AppState.prompts.activeTab ? ' active' : ''}" data-key="${k}">${lbl}${dot}</button>`;
    }).join('');
    row.querySelectorAll('.prompt-tab').forEach(btn => btn.addEventListener('click', () => this._selectTab(btn.dataset.key)));
  },

  _selectTab(key) {
    AppState.prompts.activeTab = key;
    const ta = $('promptTextarea');
    if (ta) ta.value = Prompts.get(key);
    this._renderTabs();
  },

  _onInput() {
    clearTimeout(AppState.prompts.saveTimer);
    AppState.prompts.saveTimer = setTimeout(async () => {
      const ta = $('promptTextarea');
      if (!ta) return;
      await Prompts.save(AppState.prompts.activeTab, ta.value.trim());
      this._renderTabs();
      const msg = $('promptSavedMsg');
      if (msg) { msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 1800); }
    }, 700);
  },

  async _restore() {
    if (!confirm('Restaurar o prompt padrão para este agente? Sua edição será perdida.')) return;
    const key = AppState.prompts.activeTab;
    await Prompts.save(key, PROMPTS_DEFAULT[key]);
    const ta = $('promptTextarea');
    if (ta) ta.value = PROMPTS_DEFAULT[key];
    this._renderTabs();
  },
};
