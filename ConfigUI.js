/**
 * components/ConfigUI.js
 * ───────────────────────
 * Gerencia a UI de configuração: API keys, modelo e contador de caracteres.
 */

import { Quota } from './quota.js';

const $ = id => document.getElementById(id);

// Cache de keys no localStorage (sem enviar ao servidor)
const LS = {
  get: k  => { try { return localStorage.getItem(k); }    catch { return null; }},
  set: (k,v)=>{ try { localStorage.setItem(k, v); }       catch {} },
  del: k  => { try { localStorage.removeItem(k); }        catch {} },
};

export const ConfigUI = {
  validateGeminiKey() {
    const v  = $('apiKey')?.value.trim() || '';
    const el = $('apiKey');
    const st = $('keyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; LS.del('gemini_key'); return; }
    if (v.startsWith('AIza') && v.length > 20) {
      if (el) el.className = 'valid';
      if (st) st.textContent = '✓';
      LS.set('gemini_key', v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = '✗';
    }
  },

  validateMistralKey() {
    const v  = $('mistralKey')?.value.trim() || '';
    const el = $('mistralKey');
    const st = $('mistralKeyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; LS.del('mistral_key'); return; }
    if (v.length > 20) {
      if (el) el.className = 'valid';
      if (st) st.textContent = '✓';
      LS.set('mistral_key', v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = '✗';
    }
  },

  updateQuotaInfo() {
    const hints = {
      'gemini-2.5-flash-lite': '✓ recomendado — maior cota diária gratuita',
      'gemini-2.5-flash':      '✓ boa qualidade, cota intermediária',
      'gemini-2.5-pro':        '⚠ apenas 100 req/dia — use para tarefas que exigem mais raciocínio',
    };
    const hint = $('modelHint');
    if (hint) hint.textContent = hints[$('modelSel')?.value] || '✓ modelo gratuito';
    Quota.updateUI();
  },

  updateCharCount() {
    const v  = $('inputText')?.value || '';
    const el = $('charCount');
    if (!el) return;
    el.textContent = `${v.length.toLocaleString()} caracteres`;
    el.className   = `char-count${v.length > 10000 ? ' warn' : ''}`;
  },

  /** Restaura as keys salvas no localStorage */
  restoreSavedKeys() {
    const geminiKey  = LS.get('gemini_key');
    const mistralKey = LS.get('mistral_key');
    const apiKeyEl   = $('apiKey');
    const mistralEl  = $('mistralKey');
    if (geminiKey  && apiKeyEl)  { apiKeyEl.value  = geminiKey;  this.validateGeminiKey(); }
    if (mistralKey && mistralEl) { mistralEl.value = mistralKey; this.validateMistralKey(); }
  },
};

// ─────────────────────────────────────────────────────────────

/**
 * components/ThemeUI.js + SidebarToggle
 * ───────────────────────────────────────
 */
import { AppState } from './state.js';

export const ThemeUI = {
  toggle() {
    const html = document.documentElement;
    const dark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', dark ? 'light' : 'dark');
    const btn = $('themeBtn');
    if (btn) btn.textContent = dark ? '🌙' : '☀️';
    try { localStorage.setItem('tema', dark ? 'light' : 'dark'); } catch {}
  },

  restore() {
    try {
      const tema = localStorage.getItem('tema');
      if (tema) {
        document.documentElement.setAttribute('data-theme', tema);
        const btn = $('themeBtn');
        if (btn) btn.textContent = tema === 'dark' ? '☀️' : '🌙';
      }
    } catch {}
  },
};

export const SidebarToggle = {
  toggle() {
    const open = AppState.sidebar.open = !AppState.sidebar.open;
    $('appLayout')?.classList.toggle('sidebar-collapsed', !open);
    $('appHeader')?.classList.toggle('sidebar-collapsed', !open);
    const btn = $('sidebarToggle');
    if (btn) {
      btn.textContent = open ? '◀' : '🧠';
      btn.title       = open ? 'Fechar painel de categorias' : 'Abrir painel de categorias';
    }
    try { localStorage.setItem('sb_open', open ? '1' : '0'); } catch {}
  },

  restore() {
    try {
      const saved = localStorage.getItem('sb_open');
      if (saved === '0') {
        // Começa aberto por padrão; fechar se salvo como '0'
        this.toggle();
      } else {
        AppState.sidebar.open = true;
        $('appLayout')?.classList.remove('sidebar-collapsed');
        $('appHeader')?.classList.remove('sidebar-collapsed');
        const btn = $('sidebarToggle');
        if (btn) { btn.textContent = '◀'; btn.title = 'Fechar painel de categorias'; }
      }
    } catch {}
  },
};

// ─────────────────────────────────────────────────────────────

/**
 * ConfigModal — modal de configuração de APIs e modelo
 *
 * Estratégia: os inputs #apiKey, #mistralKey e #modelSel vivem em
 * #hiddenApiInputs (fora da tela) para que api.js sempre os encontre.
 * Ao abrir o modal, os inputs são MOVIDOS para dentro dele.
 * Ao fechar, são DEVOLVIDOS ao container oculto.
 */
export const ConfigModal = {
  open() {
    if (document.getElementById('configModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'configModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--lg">
        <div class="modal-hdr">
          <span class="modal-title">⚙️ Configuração de APIs</span>
          <button class="modal-close" id="configModalClose">✕</button>
        </div>
        <div class="modal-body" style="gap:20px">

          <div class="setup-grid">
            <div class="field">
              <label>API Key do Gemini <span style="color:var(--color-success);font-weight:400">· A2 e A3</span></label>
              <div class="key-wrap" id="apiKeySlot"><span class="key-status" id="keyStatus"></span></div>
              <div class="hint">Obtenha grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></div>
            </div>
            <div class="field">
              <label>API Key da Mistral <span style="color:var(--color-success);font-weight:400">· A1</span></label>
              <div class="key-wrap" id="mistralKeySlot"><span class="key-status" id="mistralKeyStatus"></span></div>
              <div class="hint">Grátis em <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener">console.mistral.ai</a> — sem cartão · usado no A1 (Formatador)</div>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Modelo Gemini</label>
              <div id="modelSelSlot"></div>
              <div class="hint" id="modelHint"></div>
            </div>
          </div>

          <div class="config-section-divider">
            <span>Chaves de Fallback</span>
            <div class="hint" style="margin-top:4px">Acionadas automaticamente quando a chave primária retornar 503, 529 ou sobrecarga.</div>
          </div>

          <div class="setup-grid">
            <div class="field">
              <label>Gemini — Chave 2 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap" id="apiKey2Slot"><span class="key-status" id="keyStatus2"></span></div>
            </div>
            <div class="field">
              <label>Mistral — Chave 2 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap" id="mistralKey2Slot"><span class="key-status" id="mistralKeyStatus2"></span></div>
            </div>
            <div class="field">
              <label>Gemini — Chave 3 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap" id="apiKey3Slot"><span class="key-status" id="keyStatus3"></span></div>
            </div>
          </div>

        </div>
        <div class="modal-ftr" style="justify-content:flex-end">
          <span class="modal-saved" id="configSavedMsg">✓ Salvo</span>
          <button class="btn btn-primary" id="configModalClose2">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Mover inputs principais para dentro dos slots do modal
    const moveToSlot = (inputId, slotId) => {
      const input = document.getElementById(inputId);
      const slot  = document.getElementById(slotId);
      if (input && slot) slot.prepend(input);
    };
    moveToSlot('apiKey',     'apiKeySlot');
    moveToSlot('mistralKey', 'mistralKeySlot');
    moveToSlot('modelSel',   'modelSelSlot');

    // Criar e mover inputs de fallback (esses ficam só no modal)
    this._ensureFallbackInputs();
    moveToSlot('apiKey2',    'apiKey2Slot');
    moveToSlot('apiKey3',    'apiKey3Slot');
    moveToSlot('mistralKey2','mistralKey2Slot');

    // Atualizar hint do modelo
    const hints = {
      'gemini-2.5-flash-lite': '✓ recomendado — maior cota diária gratuita',
      'gemini-2.5-flash':      '✓ boa qualidade, cota intermediária',
      'gemini-2.5-pro':        '⚠ apenas 100 req/dia — use para tarefas que exigem mais raciocínio',
    };
    const modelEl = document.getElementById('modelSel');
    const hintEl  = document.getElementById('modelHint');
    if (modelEl && hintEl) hintEl.textContent = hints[modelEl.value] || '';

    // Listeners
    document.getElementById('apiKey')?.addEventListener('input',     () => { ConfigUI.validateGeminiKey();  this._showSaved(); });
    document.getElementById('mistralKey')?.addEventListener('input', () => { ConfigUI.validateMistralKey(); this._showSaved(); });
    document.getElementById('modelSel')?.addEventListener('change',  () => {
      ConfigUI.updateQuotaInfo();
      if (hintEl) hintEl.textContent = hints[modelEl?.value] || '';
      this._showSaved();
    });

    // Fallback listeners
    [['apiKey2','keyStatus2',true],['apiKey3','keyStatus3',true],['mistralKey2','mistralKeyStatus2',false]].forEach(([id,stId,isGemini]) => {
      const el = document.getElementById(id);
      const st = document.getElementById(stId);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = el.value.trim();
        const ok = isGemini ? (v.startsWith('AIza') && v.length > 20) : v.length > 20;
        if (!v) { el.className=''; if(st) st.textContent=''; try{localStorage.removeItem('fastseo_'+id);}catch{} return; }
        el.className = ok ? 'valid' : 'invalid';
        if (st) st.textContent = ok ? '✓' : '✗';
        if (ok) try{localStorage.setItem('fastseo_'+id, v);}catch{}
        this._showSaved();
      });
    });

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('configModalClose')?.addEventListener('click', close);
    document.getElementById('configModalClose2')?.addEventListener('click', close);
    document.addEventListener('keydown', this._esc);
  },

  // Garante que os inputs de fallback existem no DOM (oculto)
  _ensureFallbackInputs() {
    const hidden = document.getElementById('hiddenApiInputs');
    if (!hidden) return;
    const fallbacks = [
      { id: 'apiKey2',     placeholder: 'AIza... (secundária)' },
      { id: 'apiKey3',     placeholder: 'AIza... (terciária)'  },
      { id: 'mistralKey2', placeholder: '... (secundária)'     },
    ];
    fallbacks.forEach(({ id, placeholder }) => {
      if (!document.getElementById(id)) {
        const inp = document.createElement('input');
        inp.type = 'password'; inp.id = id; inp.placeholder = placeholder;
        inp.autocomplete = 'off';
        const saved = (() => { try { return localStorage.getItem('fastseo_'+id); } catch { return null; }})();
        if (saved) inp.value = saved;
        hidden.appendChild(inp);
      }
    });
  },

  _showSaved() {
    const msg = document.getElementById('configSavedMsg');
    if (!msg) return;
    msg.classList.add('show');
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => msg.classList.remove('show'), 1800);
  },

  close() {
    // Devolver inputs ao container oculto antes de remover o modal
    const hidden = document.getElementById('hiddenApiInputs');
    if (hidden) {
      ['apiKey','mistralKey','modelSel','apiKey2','apiKey3','mistralKey2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) hidden.appendChild(el);
      });
    }
    document.getElementById('configModalOverlay')?.remove();
    document.removeEventListener('keydown', this._esc);
  },

  _esc(e) { if (e.key === 'Escape') ConfigModal.close(); },
};
