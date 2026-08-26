/**
 * components/PromptModal.js
 */
import { AppState }          from '../modules/state.js';
import { Prompts, PROMPTS_DEFAULT, PROMPT_LABELS } from '../modules/prompts.js';
import { PipelineUI } from './PipelineUI.js';

const $ = id => document.getElementById(id);

export const PromptModal = {
  open() {
    if ($('promptModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay modal-overlay--prompt';
    overlay.id = 'promptModalOverlay';
    overlay.innerHTML = `
      <div class="modal modal--lg modal--prompt-editor">
        <div class="modal-hdr">
          <span class="modal-title"><i data-lucide="braces" aria-hidden="true"></i> Prompts dos agentes</span>
          <button class="modal-close" id="promptModalCloseBtn" type="button" aria-label="Fechar"><i data-lucide="x" aria-hidden="true"></i></button>
        </div>
        <div class="modal-body" style="gap:14px">
          <div class="prompt-tab-row" id="promptTabs"></div>
          <div style="font-size:11px;color:var(--color-text-muted)">Edite o prompt do agente selecionado. Alterações são salvas automaticamente. <span style="color:var(--color-warn)">Prompts modificados aparecem com ●</span></div>
          <textarea class="prompt-textarea" id="promptTextarea"></textarea>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-secondary" id="promptRestoreBtn">Restaurar padrão</button>
          <span class="modal-saved" id="promptSavedMsg"><i data-lucide="check" aria-hidden="true"></i> Salvo</span>
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
    // Captura e persiste a última digitação antes de remover o textarea.
    // A gravação continua em background para o botão fechar responder na hora.
    void this._saveNow({ showFeedback: false });
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
    row.querySelectorAll('.prompt-tab').forEach(btn => btn.addEventListener('click', () => { void this._selectTab(btn.dataset.key); }));
  },

  async _selectTab(key) {
    if (key !== AppState.prompts.activeTab) await this._saveNow({ showFeedback: false });
    AppState.prompts.activeTab = key;
    const ta = $('promptTextarea');
    if (ta) ta.value = Prompts.get(key);
    this._renderTabs();
  },

  _onInput() {
    clearTimeout(AppState.prompts.saveTimer);
    AppState.prompts.saveTimer = setTimeout(() => { void this._saveNow(); }, 700);
  },

  async _saveNow({ showFeedback = true } = {}) {
    clearTimeout(AppState.prompts.saveTimer);
    AppState.prompts.saveTimer = null;
    const ta = $('promptTextarea');
    if (!ta) return;
    const key = AppState.prompts.activeTab;
    const value = ta.value.trim();
    if (value === Prompts.get(key)) return;
    try {
      await Prompts.save(key, value);
      this._renderTabs();
      const msg = $('promptSavedMsg');
      if (showFeedback && msg) { msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 1800); }
    } catch (error) {
      PipelineUI.toast(`Não foi possível salvar o prompt: ${error.message}`, 'error');
    }
  },

  async _restore() {
    if (!confirm('Restaurar o prompt padrão para este agente? Sua edição será perdida.')) return;
    const key = AppState.prompts.activeTab;
    try {
      await Prompts.save(key, PROMPTS_DEFAULT[key]);
      const ta = $('promptTextarea');
      if (ta) ta.value = PROMPTS_DEFAULT[key];
      this._renderTabs();
    } catch (error) {
      PipelineUI.toast(`Não foi possível restaurar o prompt: ${error.message}`, 'error');
    }
  },
};
