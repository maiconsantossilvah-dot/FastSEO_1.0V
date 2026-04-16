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
              <div class="key-wrap"><input type="password" id="apiKey" placeholder="AIza..."/><span class="key-status" id="keyStatus"></span></div>
              <div class="hint">Obtenha grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></div>
            </div>
            <div class="field">
              <label>API Key da Mistral <span style="color:var(--color-success);font-weight:400">· A1</span></label>
              <div class="key-wrap"><input type="password" id="mistralKey" placeholder="..."/><span class="key-status" id="mistralKeyStatus"></span></div>
              <div class="hint">Grátis em <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener">console.mistral.ai</a> — sem cartão · usado no A1 (Formatador)</div>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Modelo Gemini</label>
              <select id="modelSel">
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite — 1.000 req/dia ⭐</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash — 250 req/dia</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro — 100 req/dia</option>
              </select>
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
              <div class="key-wrap"><input type="password" id="apiKey2" placeholder="AIza... (secundária)"/><span class="key-status" id="keyStatus2"></span></div>
            </div>
            <div class="field">
              <label>Mistral — Chave 2 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap"><input type="password" id="mistralKey2" placeholder="... (secundária)"/><span class="key-status" id="mistralKeyStatus2"></span></div>
            </div>
            <div class="field">
              <label>Gemini — Chave 3 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap"><input type="password" id="apiKey3" placeholder="AIza... (terciária)"/><span class="key-status" id="keyStatus3"></span></div>
            </div>
          </div>

        </div>
        <div class="modal-ftr">
          <span class="modal-saved" id="configSavedMsg">✓ Salvo</span>
          <button class="btn btn-primary" id="configModalClose2">Fechar</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Restaurar keys salvas nos inputs recém-criados
    const LS_get = k => { try { return localStorage.getItem(k); } catch { return null; }};
    const LS_set = (k,v) => { try { localStorage.setItem(k, v); } catch {} };
    const LS_del = k => { try { localStorage.removeItem(k); } catch {} };

    const restoreAndBind = (id, statusId, lsKey, validator) => {
      const el = document.getElementById(id);
      const st = document.getElementById(statusId);
      if (!el) return;
      const saved = LS_get(lsKey);
      if (saved) el.value = saved;
      validator(el, st, LS_set, LS_del);
      el.addEventListener('input', () => {
        validator(el, st, LS_set, LS_del);
        ConfigModal._showSaved();
      });
    };

    const validateGemini = (el, st, set, del) => {
      const v = el.value.trim();
      if (!v) { el.className = ''; if (st) st.textContent = ''; del('gemini_key'); return; }
      if (v.startsWith('AIza') && v.length > 20) { el.className = 'valid'; if (st) st.textContent = '✓'; set('gemini_key', v); }
      else { el.className = 'invalid'; if (st) st.textContent = '✗'; }
    };
    const validateMistral = (el, st, set, del) => {
      const v = el.value.trim();
      if (!v) { el.className = ''; if (st) st.textContent = ''; del('mistral_key'); return; }
      if (v.length > 20) { el.className = 'valid'; if (st) st.textContent = '✓'; set('mistral_key', v); }
      else { el.className = 'invalid'; if (st) st.textContent = '✗'; }
    };
    const validateGeminiFallback = (el, st, set, del) => {
      const v = el.value.trim();
      if (!v) { el.className = ''; if (st) st.textContent = ''; del('fastseo_' + el.id); return; }
      if (v.startsWith('AIza') && v.length > 20) { el.className = 'valid'; if (st) st.textContent = '✓'; set('fastseo_' + el.id, v); }
      else { el.className = 'invalid'; if (st) st.textContent = '✗'; }
    };

    restoreAndBind('apiKey',    'keyStatus',        'gemini_key',  validateGemini);
    restoreAndBind('mistralKey','mistralKeyStatus',  'mistral_key', validateMistral);
    restoreAndBind('apiKey2',   'keyStatus2',        'fastseo_apiKey2',   validateGeminiFallback);
    restoreAndBind('apiKey3',   'keyStatus3',        'fastseo_apiKey3',   validateGeminiFallback);
    restoreAndBind('mistralKey2','mistralKeyStatus2','fastseo_mistralKey2', validateMistral);

    // Restaurar modelo selecionado
    const modelEl = document.getElementById('modelSel');
    const savedModel = LS_get('fastseo_model') || 'gemini-2.5-flash-lite';
    if (modelEl) {
      modelEl.value = savedModel;
      modelEl.addEventListener('change', () => {
        LS_set('fastseo_model', modelEl.value);
        ConfigModal._showSaved();
        // Atualiza hint
        const hints = {
          'gemini-2.5-flash-lite': '✓ recomendado — maior cota diária gratuita',
          'gemini-2.5-flash':      '✓ boa qualidade, cota intermediária',
          'gemini-2.5-pro':        '⚠ apenas 100 req/dia — use para tarefas que exigem mais raciocínio',
        };
        const h = document.getElementById('modelHint');
        if (h) h.textContent = hints[modelEl.value] || '';
        // Atualiza quota
        import('./quota.js').then(({ Quota }) => Quota.updateUI());
      });
      // hint inicial
      const hints = {
        'gemini-2.5-flash-lite': '✓ recomendado — maior cota diária gratuita',
        'gemini-2.5-flash':      '✓ boa qualidade, cota intermediária',
        'gemini-2.5-pro':        '⚠ apenas 100 req/dia — use para tarefas que exigem mais raciocínio',
      };
      const h = document.getElementById('modelHint');
      if (h) h.textContent = hints[modelEl.value] || '';
    }

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('configModalClose')?.addEventListener('click', close);
    document.getElementById('configModalClose2')?.addEventListener('click', close);
    document.addEventListener('keydown', this._esc);
  },

  _showSaved() {
    const msg = document.getElementById('configSavedMsg');
    if (!msg) return;
    msg.classList.add('show');
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => msg.classList.remove('show'), 1800);
  },

  close() {
    document.getElementById('configModalOverlay')?.remove();
    document.removeEventListener('keydown', this._esc);
    // Ressincroniza ConfigUI com os valores salvos
    import('./quota.js').then(({ Quota }) => Quota.updateUI());
  },

  _esc(e) { if (e.key === 'Escape') ConfigModal.close(); },

  /** Restaura modelo salvo no select (chamado no init antes do modal abrir) */
  restoreModel() {
    try {
      const saved = localStorage.getItem('fastseo_model');
      if (saved) {
        const el = document.getElementById('modelSel');
        if (el) el.value = saved;
      }
    } catch {}
  },
};
