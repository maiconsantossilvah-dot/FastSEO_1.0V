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
 * ThemeModal — seletor de temas visuais
 * ───────────────────────────────────────
 */
import { AppState } from './state.js';

const THEMES = [
  {
    id: 'dark-glass',
    name: 'Dark Glass',
    desc: 'Glassmorphism com orbs roxos',
    preview: ['#07080f', '#6366f1', '#4ade80'],
    accent: '#6366f1', orb1: '#4f46e5', orb2: '#7c3aed',
  },
  {
    id: 'dark-cyan',
    name: 'Dark Cyan',
    desc: 'Escuro com acento ciano',
    preview: ['#060d12', '#06b6d4', '#34d399'],
    accent: '#06b6d4', orb1: '#0e7490', orb2: '#065f46',
  },
  {
    id: 'dark-rose',
    name: 'Dark Rose',
    desc: 'Escuro com acento rosa',
    preview: ['#0d0709', '#f43f5e', '#c084fc'],
    accent: '#f43f5e', orb1: '#9f1239', orb2: '#7e22ce',
  },
  {
    id: 'dark-amber',
    name: 'Dark Amber',
    desc: 'Escuro com acento dourado',
    preview: ['#0c0a03', '#f59e0b', '#fb923c'],
    accent: '#f59e0b', orb1: '#92400e', orb2: '#7c2d12',
  },
  {
    id: 'dark-slate',
    name: 'Dark Slate',
    desc: 'Minimalista sem orbs',
    preview: ['#0f1117', '#64748b', '#94a3b8'],
    accent: '#64748b', orb1: 'transparent', orb2: 'transparent',
  },
];

const LS_THEME = 'fastseo_theme';

function applyTheme(t) {
  const root = document.documentElement;
  root.setAttribute('data-theme', 'dark');
  root.setAttribute('data-theme-id', t.id);
  root.style.setProperty('--color-accent',        t.accent);
  root.style.setProperty('--color-accent-hover',   t.accent + 'cc');
  root.style.setProperty('--color-accent-bg',      t.accent + '1f');
  root.style.setProperty('--color-accent-glow',    t.accent + '40');
  root.style.setProperty('--orb1-color', t.orb1);
  root.style.setProperty('--orb2-color', t.orb2);
  try { localStorage.setItem(LS_THEME, t.id); } catch {}
}

export const ThemeModal = {
  open() {
    if ($('themeModalOverlay')) return;
    const savedId  = (() => { try { return localStorage.getItem(LS_THEME); } catch { return null; } })() || 'dark-glass';

    const overlay = document.createElement('div');
    overlay.id = 'themeModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--theme">
        <div class="modal-hdr">
          <span class="modal-title">🎨 Aparência do site</span>
          <button class="modal-close" id="themeModalClose">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:12px;color:var(--color-text-muted);margin-top:-4px">Escolha o tema visual. A mudança é aplicada imediatamente.</p>
          <div class="theme-grid" id="themeGrid"></div>
        </div>
        <div class="modal-ftr" style="justify-content:flex-end">
          <button class="btn btn-primary" id="themeModalConfirm">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const grid = overlay.querySelector('#themeGrid');

    THEMES.forEach(t => {
      const card = document.createElement('div');
      card.className = 'theme-card' + (t.id === savedId ? ' theme-card--active' : '');
      card.dataset.id = t.id;
      card.innerHTML = `
        <div class="theme-preview">
          <div class="theme-preview-bg" style="background:${t.preview[0]}">
            <div class="theme-preview-orb" style="background:${t.preview[1]}"></div>
            <div class="theme-preview-card">
              <div class="theme-preview-bar" style="background:${t.preview[1]}88"></div>
              <div class="theme-preview-bar short" style="background:${t.preview[2]}66"></div>
              <div class="theme-preview-btn" style="background:${t.preview[1]}"></div>
            </div>
          </div>
        </div>
        <div class="theme-card-info">
          <span class="theme-card-name">${t.name}</span>
          <span class="theme-card-desc">${t.desc}</span>
        </div>
        <div class="theme-check">✓</div>`;
      card.addEventListener('click', () => {
        grid.querySelectorAll('.theme-card').forEach(c => c.classList.remove('theme-card--active'));
        card.classList.add('theme-card--active');
        applyTheme(t);
      });
      grid.appendChild(card);
    });

    const close = () => this.close();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    $('themeModalClose')?.addEventListener('click', close);
    $('themeModalConfirm')?.addEventListener('click', close);
    document.addEventListener('keydown', this._esc);
  },

  close() {
    $('themeModalOverlay')?.remove();
    document.removeEventListener('keydown', this._esc);
  },

  _esc(e) { if (e.key === 'Escape') ThemeModal.close(); },

  restore() {
    try {
      const id = localStorage.getItem(LS_THEME) || 'dark-glass';
      const t  = THEMES.find(t => t.id === id) || THEMES[0];
      applyTheme(t);
    } catch {}
  },
};

// Compatibilidade com imports que usam ThemeUI
export const ThemeUI = {
  toggle()  { ThemeModal.open(); },
  restore() { ThemeModal.restore(); },
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
