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

// ── Grupos de temas ──────────────────────────────────────────
// Cada tema pode ter: accent, orb1, orb2, bg, surface, border, text
// Campos omitidos usam os valores padrão do CSS.
const THEMES = [

  // ── Glassmorphism (com orbs de luz) ──────────────────────
  {
    id: 'glass-indigo',
    group: 'Glassmorphism',
    name: 'Indigo Glass',
    desc: 'Orbs roxos vibrantes',
    preview: ['#07080f', '#6366f1', '#818cf8'],
    accent: '#6366f1', orb1: '#4f46e5', orb2: '#7c3aed',
    bg: '#07080f',
  },
  {
    id: 'glass-cyan',
    group: 'Glassmorphism',
    name: 'Cyan Glass',
    desc: 'Orbs em verde-água',
    preview: ['#050e12', '#06b6d4', '#34d399'],
    accent: '#06b6d4', orb1: '#0e7490', orb2: '#065f46',
    bg: '#050e12',
  },
  {
    id: 'glass-rose',
    group: 'Glassmorphism',
    name: 'Rose Glass',
    desc: 'Orbs em rosa e violeta',
    preview: ['#0d0709', '#e879a0', '#c084fc'],
    accent: '#e879a0', orb1: '#9f1239', orb2: '#7e22ce',
    bg: '#0d0709',
  },

  // ── Sólido escuro (sem orbs, cores suaves) ────────────────
  {
    id: 'solid-charcoal',
    group: 'Sólido escuro',
    name: 'Charcoal',
    desc: 'Cinza carvão, acento azul',
    preview: ['#1a1b1e', '#3b82f6', '#60a5fa'],
    accent: '#3b82f6', orb1: 'transparent', orb2: 'transparent',
    bg: '#141517', surface: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.1)',
  },
  {
    id: 'solid-graphite',
    group: 'Sólido escuro',
    name: 'Graphite',
    desc: 'Quase preto, acento verde',
    preview: ['#111111', '#22c55e', '#4ade80'],
    accent: '#22c55e', orb1: 'transparent', orb2: 'transparent',
    bg: '#0d0d0d', surface: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.09)',
  },
  {
    id: 'solid-navy',
    group: 'Sólido escuro',
    name: 'Navy',
    desc: 'Azul marinho profundo',
    preview: ['#0d1117', '#58a6ff', '#79c0ff'],
    accent: '#58a6ff', orb1: 'transparent', orb2: 'transparent',
    bg: '#0d1117', surface: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.1)',
  },
  {
    id: 'solid-espresso',
    group: 'Sólido escuro',
    name: 'Espresso',
    desc: 'Marrom escuro, acento âmbar',
    preview: ['#1a1208', '#d97706', '#fbbf24'],
    accent: '#d97706', orb1: 'transparent', orb2: 'transparent',
    bg: '#130e06', surface: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.09)',
  },

  // ── Neutro / sem brilho ───────────────────────────────────
  {
    id: 'neutral-zinc',
    group: 'Neutro',
    name: 'Zinc',
    desc: 'Cinza frio, sem destaques',
    preview: ['#18181b', '#71717a', '#a1a1aa'],
    accent: '#71717a', orb1: 'transparent', orb2: 'transparent',
    bg: '#18181b', surface: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.08)',
  },
  {
    id: 'neutral-stone',
    group: 'Neutro',
    name: 'Stone',
    desc: 'Bege escuro, tom quente',
    preview: ['#1c1917', '#78716c', '#a8a29e'],
    accent: '#a8a29e', orb1: 'transparent', orb2: 'transparent',
    bg: '#1c1917', surface: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.08)',
  },
  {
    id: 'neutral-void',
    group: 'Neutro',
    name: 'Void',
    desc: 'Preto puro, mínimo absoluto',
    preview: ['#000000', '#404040', '#737373'],
    accent: '#525252', orb1: 'transparent', orb2: 'transparent',
    bg: '#000000', surface: 'rgba(255,255,255,.03)',
    border: 'rgba(255,255,255,.07)',
  },

  // ── Anime ─────────────────────────────────────────────────
  {
    id: 'anime-vegito-ssj',
    group: 'Anime',
    name: 'Vegito SSJ',
    desc: 'Dourado explosivo · aura flamejante',
    preview: ['#07040a', '#f5a623', '#ffe066'],
    accent: '#f5a623',
    orb1: '#cc6600',
    orb2: '#ff4400',
    bg: '#07040a',
    surface: 'rgba(245,166,35,.06)',
    border: 'rgba(245,166,35,.18)',
    logoIcon: `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" fill="#1a0e00" stroke="#cc6600" stroke-width="1"/>
      <path d="M14 4 C14 4 10 7 9 11 C8 13 9 15 11 15 C10 17 11 19 14 20 C17 19 18 17 17 15 C19 15 20 13 19 11 C18 7 14 4 14 4Z" fill="#f5a623" stroke="#cc6600" stroke-width=".5"/>
      <path d="M11 10 C11 10 9 11 10 13 C10.5 14 11 14 11 14" stroke="#ffe066" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <path d="M17 10 C17 10 19 11 18 13 C17.5 14 17 14 17 14" stroke="#ffe066" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <ellipse cx="14" cy="13" rx="2" ry="2.5" fill="#ffcc44" stroke="#cc6600" stroke-width=".5"/>
      <path d="M12.5 13 L11 12.5 M15.5 13 L17 12.5" stroke="#fff8cc" stroke-width=".6" stroke-linecap="round"/>
      <path d="M13 14.5 L13.5 15.5 L14 14.5 L14.5 15.5 L15 14.5" stroke="#cc6600" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="12.2" cy="17.5" r=".8" fill="#ffcc00" stroke="#cc6600" stroke-width=".4"/>
      <circle cx="15.8" cy="17.5" r=".8" fill="#ffcc00" stroke="#cc6600" stroke-width=".4"/>
      <path d="M8 18 Q14 22 20 18" stroke="#f5a623" stroke-width=".6" fill="none" stroke-linecap="round"/>
    </svg>`,
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L6 6 L2 6 L5.5 9.5 L4 14 L8 11 L12 14 L10.5 9.5 L14 6 L10 6 Z" fill="#ffe066" stroke="#f5a623" stroke-width=".5"/>
      <path d="M6.5 5 L5 3 M9.5 5 L11 3 M8 4 L8 1.5" stroke="#fff8cc" stroke-width=".7" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'anime-vegito-blue',
    group: 'Anime',
    name: 'Vegito Blue',
    desc: 'SSJ Blue · ki elétrico · Potara',
    preview: ['#03080f', '#00bfff', '#60e0ff'],
    accent: '#00bfff',
    orb1: '#0055aa',
    orb2: '#003380',
    bg: '#03080f',
    surface: 'rgba(0,191,255,.05)',
    border: 'rgba(0,191,255,.2)',
    logoIcon: `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" fill="#020810" stroke="#0066cc" stroke-width="1"/>
      <path d="M14 3 C14 3 10 6 9 10 C8 12 9 14 11 14 C10 16 11 18 14 19.5 C17 18 18 16 17 14 C19 14 20 12 19 10 C18 6 14 3 14 3Z" fill="#00bfff" stroke="#0044aa" stroke-width=".5" opacity=".9"/>
      <path d="M11 9 C11 9 8.5 10 9.5 12.5" stroke="#60e0ff" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <path d="M17 9 C17 9 19.5 10 18.5 12.5" stroke="#60e0ff" stroke-width=".8" stroke-linecap="round" fill="none"/>
      <ellipse cx="14" cy="12.5" rx="2" ry="2.2" fill="#e8f8ff" stroke="#00bfff" stroke-width=".5"/>
      <path d="M12.5 12.5 L11 12 M15.5 12.5 L17 12" stroke="#00bfff" stroke-width=".6" stroke-linecap="round"/>
      <path d="M13 14 L13.5 15 L14 14 L14.5 15 L15 14" stroke="#0066cc" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="17" r=".9" fill="#e0e0e0" stroke="#aaa" stroke-width=".4"/>
      <circle cx="12" cy="18.2" r=".6" fill="#ffcc00" stroke="#cc9900" stroke-width=".3"/>
      <circle cx="16" cy="17" r=".9" fill="#e0e0e0" stroke="#aaa" stroke-width=".4"/>
      <circle cx="16" cy="18.2" r=".6" fill="#ffcc00" stroke="#cc9900" stroke-width=".3"/>
      <path d="M6 20 Q10 23 14 21 Q18 23 22 20" stroke="#00bfff" stroke-width=".5" fill="none" stroke-linecap="round" opacity=".6"/>
      <path d="M5 16 L4 15 M5 18 L3.5 17.5 M23 16 L24 15 M23 18 L24.5 17.5" stroke="#60e0ff" stroke-width=".6" stroke-linecap="round" opacity=".7"/>
    </svg>`,
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L9.5 6 L14 6 L10 9 L11.5 14 L8 11 L4.5 14 L6 9 L2 6 L6.5 6 Z" fill="#60e0ff" stroke="#00bfff" stroke-width=".5" opacity=".9"/>
      <path d="M5 4 L4 2 M8 3 L8 1 M11 4 L12 2" stroke="#fff" stroke-width=".6" stroke-linecap="round" opacity=".7"/>
    </svg>`,
  },
  {
    id: 'anime-seinen',
    group: 'Anime',
    name: 'Seinen',
    desc: 'Manga · hachuras · papel envelhecido',
    preview: ['#f0ebe0', '#111111', '#555555'],
    accent: '#111111',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#f0ebe0',
    surface: 'rgba(0,0,0,.04)',
    border: 'rgba(0,0,0,.25)',
    isLight: true,
    logoIcon: null,
    runIcon: null,
  },
];

const LS_THEME = 'fastseo_theme';

function applyTheme(t) {
  const root = document.documentElement;
  root.setAttribute('data-theme', t.isLight ? 'light' : 'dark');
  root.setAttribute('data-theme-id', t.id);

  // Accent
  root.style.setProperty('--color-accent',       t.accent);
  root.style.setProperty('--color-accent-hover',  t.accent + 'dd');
  root.style.setProperty('--color-accent-bg',     t.accent + '1a');
  root.style.setProperty('--color-accent-glow',   t.accent + '35');

  // Orbs (glassmorphism)
  root.style.setProperty('--orb1-color', t.orb1 || 'transparent');
  root.style.setProperty('--orb2-color', t.orb2 || 'transparent');

  // Fundo e superfície
  root.style.setProperty('--color-bg-page',  t.bg      || '#07080f');
  root.style.setProperty('--color-surface',  t.surface || 'rgba(255,255,255,.04)');
  root.style.setProperty('--color-border',   t.border  || 'rgba(255,255,255,.08)');

  // Temas claros (Seinen) — ajusta texto e sidebar
  if (t.isLight) {
    root.style.setProperty('--color-text-primary',   '#111111');
    root.style.setProperty('--color-text-secondary', '#444444');
    root.style.setProperty('--color-text-muted',     'rgba(0,0,0,.4)');
    root.style.setProperty('--color-sidebar-bg',     'rgba(240,235,224,.95)');
    root.style.setProperty('--color-header-bg',      'rgba(17,17,17,.97)');
    root.style.setProperty('--color-log-bg',         '#111111');
    root.style.setProperty('--color-success',        '#166534');
    root.style.setProperty('--color-danger',         '#991b1b');
    root.style.setProperty('--color-warn',           '#92400e');
    root.style.setProperty('--seinen-hatching', '1');
  } else {
    root.style.setProperty('--color-text-primary',   '#e2e8f0');
    root.style.setProperty('--color-text-secondary', '#94a3b8');
    root.style.setProperty('--color-text-muted',     'rgba(255,255,255,.3)');
    root.style.setProperty('--color-sidebar-bg',     'rgba(5,6,12,.7)');
    root.style.setProperty('--color-header-bg',      'rgba(7,8,15,.85)');
    root.style.setProperty('--color-log-bg',         'rgba(0,0,0,.5)');
    root.style.setProperty('--color-success',        '#4ade80');
    root.style.setProperty('--color-danger',         '#f87171');
    root.style.setProperty('--color-warn',           '#fbbf24');
    root.style.setProperty('--seinen-hatching', '0');
  }

  // Logo glow
  const hasOrbs = t.orb1 && t.orb1 !== 'transparent';
  root.style.setProperty('--logo-glow', hasOrbs
    ? `0 0 20px ${t.accent}80`
    : 'none');

  // Ícone customizado do logo (temas anime)
  if (t.logoIcon) {
    const logoEl = document.querySelector('.logo-icon');
    if (logoEl) logoEl.innerHTML = t.logoIcon;
  } else {
    const logoEl = document.querySelector('.logo-icon');
    if (logoEl) logoEl.textContent = 'F';
  }

  // Ícone customizado do botão run
  const runIconEl = document.querySelector('.run-icon');
  if (runIconEl) {
    if (t.runIcon) {
      runIconEl.innerHTML = t.runIcon + ' Processar Ficha';
    } else {
      runIconEl.textContent = '⚡ Processar Ficha';
    }
  }

  // Hachuras Seinen no body
  document.body.classList.toggle('theme-seinen', !!t.isLight);

  try { localStorage.setItem(LS_THEME, t.id); } catch {}
}

export const ThemeModal = {
  open() {
    if ($('themeModalOverlay')) return;
    const savedId = (() => { try { return localStorage.getItem(LS_THEME); } catch { return null; } })() || 'glass-indigo';

    const overlay = document.createElement('div');
    overlay.id = 'themeModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal--theme">
        <div class="modal-hdr">
          <span class="modal-title">🎨 Aparência do site</span>
          <button class="modal-close" id="themeModalClose">✕</button>
        </div>
        <div class="modal-body" id="themeModalBody">
        </div>
        <div class="modal-ftr" style="justify-content:flex-end">
          <button class="btn btn-primary" id="themeModalConfirm">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const body = overlay.querySelector('#themeModalBody');

    // Agrupar por grupo
    const groups = [...new Set(THEMES.map(t => t.group))];
    groups.forEach(groupName => {
      const groupThemes = THEMES.filter(t => t.group === groupName);

      const label = document.createElement('div');
      label.className = 'theme-group-label';
      label.textContent = groupName;
      body.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'theme-grid';
      body.appendChild(grid);

      groupThemes.forEach(t => {
        const card = document.createElement('div');
        card.className = 'theme-card' + (t.id === savedId ? ' theme-card--active' : '');
        card.dataset.id = t.id;
        const hasOrbs = t.orb1 && t.orb1 !== 'transparent';
        const btnColor = t.isLight ? t.preview[0] : t.accent;
        const bgPattern = t.isLight
          ? `background:${t.preview[0]};background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.06) 0px,rgba(0,0,0,.06) 1px,transparent 1px,transparent 5px)`
          : `background:${t.preview[0]}`;

        card.innerHTML = `
          <div class="theme-preview">
            <div class="theme-preview-bg" style="${bgPattern}">
              ${hasOrbs ? `<div class="theme-preview-orb" style="background:${t.orb1}"></div>` : ''}
              <div class="theme-preview-logo" style="background:${t.isLight ? '#111' : t.accent + '25'};border:1px solid ${t.isLight ? '#333' : t.accent + '55'};border-radius:6px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;position:absolute;top:6px;left:6px">
                <span style="font-size:7px;font-weight:900;color:${t.isLight ? '#f0ebe0' : t.accent}">F</span>
              </div>
              <div class="theme-preview-card" style="border-color:${t.isLight ? '#111' : 'rgba(255,255,255,.12)'};${t.isLight ? 'box-shadow:2px 2px 0 #111' : ''}">
                <div class="theme-preview-bar" style="background:${t.accent}${t.isLight ? '' : '99'}"></div>
                <div class="theme-preview-bar short" style="background:${t.preview[2]}${t.isLight ? 'cc' : '66'}"></div>
                <div class="theme-preview-btn" style="background:${t.isLight ? '#111' : t.accent}"></div>
              </div>
            </div>
          </div>
          <div class="theme-card-info">
            <span class="theme-card-name">${t.name}</span>
            <span class="theme-card-desc">${t.desc}</span>
          </div>
          <div class="theme-check">✓</div>`;
        card.addEventListener('click', () => {
          overlay.querySelectorAll('.theme-card').forEach(c => c.classList.remove('theme-card--active'));
          card.classList.add('theme-card--active');
          applyTheme(t);
        });
        grid.appendChild(card);
      });
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
