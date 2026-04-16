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

// Temas disponíveis
const THEMES = [
  {
    id: 'dark-glass',
    name: 'Dark Glass',
    desc: 'Glassmorphism escuro com orbs de luz',
    preview: ['#07080f', '#6366f1', '#4ade80'],
    vars: {
      '--color-bg-page': '#07080f',
      '--color-accent':  '#6366f1',
      '--orb1': '#4f46e5',
      '--orb2': '#7c3aed',
    }
  },
  {
    id: 'dark-cyan',
    name: 'Dark Cyan',
    desc: 'Escuro com acento em ciano e verde-água',
    preview: ['#060d12', '#06b6d4', '#34d399'],
    vars: {
      '--color-bg-page': '#060d12',
      '--color-accent':  '#06b6d4',
      '--orb1': '#0e7490',
      '--orb2': '#065f46',
    }
  },
  {
    id: 'dark-rose',
    name: 'Dark Rose',
    desc: 'Escuro com acento em rosa e violeta',
    preview: ['#0d0709', '#f43f5e', '#c084fc'],
    vars: {
      '--color-bg-page': '#0d0709',
      '--color-accent':  '#f43f5e',
      '--orb1': '#9f1239',
      '--orb2': '#7e22ce',
    }
  },
  {
    id: 'dark-amber',
    name: 'Dark Amber',
    desc: 'Escuro com acento dourado e laranja',
    preview: ['#0c0a03', '#f59e0b', '#fb923c'],
    vars: {
      '--color-bg-page': '#0c0a03',
      '--color-accent':  '#f59e0b',
      '--orb1': '#92400e',
      '--orb2': '#7c2d12',
    }
  },
  {
    id: 'dark-slate',
    name: 'Dark Slate',
    desc: 'Minimalista sem orbs, apenas cinza frio',
    preview: ['#0f1117', '#64748b', '#94a3b8'],
    vars: {
      '--color-bg-page': '#0f1117',
      '--color-accent':  '#64748b',
      '--orb1': 'transparent',
      '--orb2': 'transparent',
    }
  },
];

const LS_THEME = 'fastseo_theme';

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', 'dark');
  root.setAttribute('data-theme-id', theme.id);
  // Aplica accent
  root.style.setProperty('--color-accent',       theme.vars['--color-accent']);
  root.style.setProperty('--color-accent-hover',  theme.vars['--color-accent'] + 'cc');
  root.style.setProperty('--color-accent-bg',     theme.vars['--color-accent'] + '1f');
  root.style.setProperty('--color-accent-glow',   theme.vars['--color-accent'] + '40');
  // Aplica fundo
  root.style.setProperty('--color-bg-page',       theme.vars['--color-bg-page']);
  // Injeta orbs via CSS custom props usados no ::before/::after do body
  root.style.setProperty('--orb1-color', theme.vars['--orb1']);
  root.style.setProperty('--orb2-color', theme.vars['--orb2']);
  try { localStorage.setItem(LS_THEME, theme.id); } catch {}
}

export const ThemeModal = {
  open() {
    if ($('themeModalOverlay')) return;
    const saved = (() => { try { return localStorage.getItem(LS_THEME); } catch { return null; }})();
    const activeId = saved || 'dark-glass';

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
          <button class="btn btn-primary" id="themeModalConfirm">Aplicar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Renderiza cards
    const grid = overlay.querySelector('#themeGrid');
    let selectedId = activeId;

    THEMES.forEach(t => {
      const card = document.createElement('div');
      card.className = 'theme-card' + (t.id === activeId ? ' theme-card--active' : '');
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
        selectedId = t.id;
        // Preview ao vivo
        applyTheme(t);
      });
      grid.appendChild(card);
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
    overlay.querySelector('#themeModalClose').addEventListener('click', () => this.close());
    overlay.querySelector('#themeModalConfirm').addEventListener('click', () => {
      const t = THEMES.find(t => t.id === selectedId);
      if (t) applyTheme(t);
      this.close();
    });
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

// Compatibilidade: ThemeUI ainda exportado para não quebrar imports antigos
export const ThemeUI = {
  toggle() { ThemeModal.open(); },
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
