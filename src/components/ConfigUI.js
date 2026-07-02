/**
 * components/ConfigUI.js
 * Gerencia a UI de configuração: API keys, modelo e contador de caracteres.
 */

import { Quota } from '../modules/quota.js';
import { getGoogleApiKey, setGoogleApiKey, getGoogleCx, setGoogleCx, hasSerpApiKey } from '../services/serp.js';
import { trackSerpApiConfigurada } from '../services/analytics.js';
const $ = id => document.getElementById(id);

// Cache de keys no localStorage (sem enviar ao servidor)
const LS = {
  get: k    => { try { return localStorage.getItem(k); }  catch { return null; }},
  set: (k,v)=> { try { localStorage.setItem(k, v); }      catch {} },
  del: k    => { try { localStorage.removeItem(k); }      catch {} },
};

export const ConfigUI = {
  // Debounce interno para updateCharCount.
  _charCountTimer: null,

  validateGeminiKey() {
    const v  = $('apiKey')?.value.trim() || '';
    const el = $('apiKey');
    const st = $('keyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; LS.del('gemini_key'); return; }
    if (v.startsWith('AIza') && v.length > 20) {
      if (el) el.className = 'valid';
      if (st) st.textContent = 'OK';
      LS.set('gemini_key', v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = 'X';
    }
  },

  validateMistralKey() {
    const v  = $('mistralKey')?.value.trim() || '';
    const el = $('mistralKey');
    const st = $('mistralKeyStatus');
    if (!v) { if (el) el.className = ''; if (st) st.textContent = ''; LS.del('mistral_key'); return; }
    if (v.length > 20) {
      if (el) el.className = 'valid';
      if (st) st.textContent = 'OK';
      LS.set('mistral_key', v);
    } else {
      if (el) el.className = 'invalid';
      if (st) st.textContent = 'X';
    }
  },

  updateQuotaInfo() {
    const hints = {
      'gemini-2.5-flash-lite': 'Recomendado - maior cota diária gratuita',
      'gemini-2.5-flash':      'Boa qualidade, cota intermediária',
      'gemini-2.5-pro':        'Apenas 100 req/dia - use para tarefas que exigem mais raciocínio',
    };
    const hint = $('modelHint');
    if (hint) hint.textContent = hints[$('modelSel')?.value] || 'Modelo gratuito';
    Quota.updateUI();
  },

  updateCharCount() {
    clearTimeout(this._charCountTimer);
    this._charCountTimer = setTimeout(() => {
      const v  = $('inputText')?.value || '';
      const el = $('charCount');
      if (!el) return;
      el.textContent = `${v.length.toLocaleString()} caracteres`;
      el.className   = `char-count${v.length > 10000 ? ' warn' : ''}`;
    }, 120);
  },

  restoreSavedKeys() {
    const geminiKey  = LS.get('gemini_key');
    const mistralKey = LS.get('mistral_key');
    const apiKeyEl   = $('apiKey');
    const mistralEl  = $('mistralKey');
    if (geminiKey  && apiKeyEl)  { apiKeyEl.value  = geminiKey;  this.validateGeminiKey(); }
    if (mistralKey && mistralEl) { mistralEl.value = mistralKey; this.validateMistralKey(); }
  },
  
};
// initSerpConfig - ativa os eventos da seção SerpAPI no modal.
// Chamada dentro de ConfigModal.open(), após appendChild(overlay).
export function initSerpConfig() {
  const apiKeyInput   = document.getElementById('serp-api-key-input');
  const cxInput       = document.getElementById('serp-cx-input');
  const toggleBtn     = document.getElementById('serp-api-key-toggle');
  const saveBtn       = document.getElementById('serp-api-key-save');
  const status        = document.getElementById('serp-api-status');
  const quotaLabel    = document.getElementById('serp-quota-label');
  const quotaFill     = document.getElementById('serp-quota-fill');
  const clearCacheBtn = document.getElementById('serp-cache-clear');

  if (!apiKeyInput) return; // Seção ainda não foi renderizada no modal.

  // Preenche com valores já salvos.
  const apiKeySalva = getGoogleApiKey();
  const cxSalvo     = getGoogleCx();
  if (apiKeySalva) { apiKeyInput.value = apiKeySalva; }
  if (cxSalvo)     { if (cxInput) cxInput.value = cxSalvo; }
  if (apiKeySalva && cxSalvo) _serpStatus(status, true);
  _serpQuota(quotaLabel, quotaFill);

  // Toggle mostrar/ocultar API key
  toggleBtn?.addEventListener('click', () => {
    const visivel = apiKeyInput.type === 'text';
    apiKeyInput.type = visivel ? 'password' : 'text';
    toggleBtn.textContent = visivel ? 'Mostrar' : 'Ocultar';
  });

  // Salvar chaves
  saveBtn?.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const cx     = cxInput?.value.trim() || '';
    if (!apiKey) { _serpStatus(status, false, 'Cole sua API Key do Google antes de salvar.'); return; }
    if (!cx)     { _serpStatus(status, false, 'Cole o Search Engine ID (cx) antes de salvar.'); return; }
    setGoogleApiKey(apiKey);
    setGoogleCx(cx);
    trackSerpApiConfigurada();
    _serpStatus(status, true, 'Chaves salvas com sucesso!');
    setTimeout(() => _serpStatus(status, true), 3000);
  });

  // Limpar cache
  clearCacheBtn?.addEventListener('click', () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('fastseo_serp_cache_'))
      .forEach(k => localStorage.removeItem(k));
    _serpQuota(quotaLabel, quotaFill);
    clearCacheBtn.textContent = 'Cache limpo!';
    setTimeout(() => { clearCacheBtn.textContent = 'Limpar cache'; }, 2000);
  });
}

function _serpStatus(el, ok, mensagem) {
  if (!el) return;
  el.textContent = mensagem ?? (ok ? 'Chave configurada' : '');
  el.className   = `serp-status ${ok ? 'serp-status--ok' : mensagem ? 'serp-status--erro' : ''}`;
}

function _serpQuota(labelEl, fillEl) {
  const mes   = new Date().toISOString().slice(0, 7);
  const count = parseInt(localStorage.getItem(`fastseo_serp_count_${mes}`) || '0');
  const pct   = Math.min((count / 100) * 100, 100);
  if (labelEl) labelEl.textContent = `${count} / 100 buscas este mês`;
  if (fillEl) {
    fillEl.style.width      = `${pct}%`;
    fillEl.style.background = pct > 80 ? 'var(--color-warn)' : 'var(--color-success)';
  }
}

/**
 * ThemeModal - seletor de temas visuais
 */
import { AppState } from '../modules/state.js';
const ICE_BTN_IMG = '../assets/img/ice-button.webp';
const LAST_RITE_PH = '../assets/img/last-rite-placeholder.webp';
const LAST_RITE_BG = '../assets/img/last-rite-bg.webp';
const VEGITO_SSJ_BG = '../assets/img/vegito-ssj-bg.jpg';
const VEGITO_BLUE_BG = '../assets/img/vegito-blue-bg.jpg';

const GOKU_LOGO_IMG = '../assets/img/goku-logo.png';
const GOKU_PH_IMG = '../assets/img/goku-placeholder.png';

const ZHUANG_BG ="../assets/img/zhuang-fangyi.jpg";
// Cada tema pode ter: accent, orb1, orb2, bg, surface, border, text
// Campos omitidos usam os valores padrão do CSS.
const THEMES = [
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
  {
    id: 'anime-vegito-ssj',
    group: 'Anime',
    name: 'Vegito SSJ',
    desc: 'Dourado refinado - aura quente',
    preview: ['#070507', '#d99a2b', '#f1cf76'],
    accent: '#d99a2b',
    orb1: 'rgba(217,154,43,.28)',
    orb2: 'rgba(160,75,28,.22)',
    bg: '#070507',
    bgImage: 'ssj',
    surface: 'rgba(12,8,5,.78)',
    border: 'rgba(217,154,43,.18)',
    logoIcon: `<img src='${GOKU_LOGO_IMG}' style='width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:50%;filter:sepia(1) saturate(4) hue-rotate(5deg) brightness(1.2)'/>`,
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L6 6 L2 6 L5.5 9.5 L4 14 L8 11 L12 14 L10.5 9.5 L14 6 L10 6 Z" fill="#ffe066" stroke="#f5a623" stroke-width=".5"/>
      <path d="M6.5 5 L5 3 M9.5 5 L11 3 M8 4 L8 1.5" stroke="#fff8cc" stroke-width=".7" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'anime-vegito-blue',
    group: 'Anime',
    name: 'Vegito Blue',
    desc: 'SSJ Blue - azul limpo - Potara',
    preview: ['#03080d', '#3fb6d9', '#8bd7ee'],
    accent: '#3fb6d9',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#03080d',
    bgImage: true,
    surface: 'rgba(3,10,16,.78)',
    border: 'rgba(63,182,217,.2)',
    logoIcon: `<img src='${GOKU_LOGO_IMG}' style='width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:50%;filter:sepia(1) saturate(5) hue-rotate(175deg) brightness(1.1)'/>`,  
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L9.5 6 L14 6 L10 9 L11.5 14 L8 11 L4.5 14 L6 9 L2 6 L6.5 6 Z" fill="#60e0ff" stroke="#00bfff" stroke-width=".5" opacity=".9"/>
      <path d="M5 4 L4 2 M8 3 L8 1 M11 4 L12 2" stroke="#fff" stroke-width=".6" stroke-linecap="round" opacity=".7"/>
    </svg>`,
  },
  {
    id: 'anime-serenity',
    group: 'Anime',
    name: 'Serenity',
    desc: 'Lavanda suave - azul noite',
    preview: ['#07071a', '#c6a6d9', '#f0d8ee'],
    accent: '#c6a6d9',
    orb1: 'rgba(126,98,160,.34)',
    orb2: 'rgba(44,35,82,.28)',
    bg: '#06060f',
    surface: 'rgba(16,12,28,.72)',
    border: 'rgba(198,166,217,.18)',
    logoIcon: `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2 L16.5 9.5 L24.5 9.5 L18.2 14.5 L20.5 22 L14 17.5 L7.5 22 L9.8 14.5 L3.5 9.5 L11.5 9.5 Z"
        fill="#c9a0dc" stroke="#7b5ea7" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M14 4.5 L15.8 10 L21.5 10 L17 13.2 L18.8 19 L14 15.8 L9.2 19 L11 13.2 L6.5 10 L12.2 10 Z"
        fill="#e8d0f4" opacity=".5"/>
    </svg>`,
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L9.5 5.5 L14.5 5.5 L10.5 8.5 L12 13 L8 10 L4 13 L5.5 8.5 L1.5 5.5 L6.5 5.5 Z"
        fill="#ffd6f0" stroke="#c9a0dc" stroke-width=".5" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'anime-last-rite',
    group: 'Anime',
    name: 'Last Rite',
    desc: 'Cryo - gelo suave - bordeaux',
    preview: ['#040810', '#74b7e6', '#9e3f55'],
    accent: '#74b7e6',
    orb1: 'rgba(56,111,166,.24)',
    orb2: 'rgba(108,37,54,.18)',
    bg: '#040810',
    bgImage: 'lastrite',
    surface: 'rgba(4,10,18,.78)',
    border: 'rgba(116,183,230,.18)',
    logoIcon: `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" fill="#03080f" stroke="#1a4daa" stroke-width=".8"/>
      <path d="M14 3 L16 9.5 L22.5 9.5 L17.5 13.5 L19.5 20 L14 16.5 L8.5 20 L10.5 13.5 L5.5 9.5 L12 9.5 Z"
        fill="#a8d8ff" opacity=".95" stroke="#4da6ff" stroke-width=".4" stroke-linejoin="round"/>
      <path d="M14 6 L15.2 9.8 L19.5 9.8 L16.5 12 L17.5 16 L14 13.8 L10.5 16 L11.5 12 L8.5 9.8 L12.8 9.8 Z"
        fill="#04193a" opacity=".8"/>
      <circle cx="14" cy="14" r="1.2" fill="#a8d8ff" opacity=".6"/>
    </svg>`,
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <path d="M8 1 L9.5 5.5 L14.5 5.5 L10.5 8.5 L12 13 L8 10 L4 13 L5.5 8.5 L1.5 5.5 L6.5 5.5 Z"
        fill="#a8d8ff" stroke="#4da6ff" stroke-width=".5" stroke-linejoin="round"/>
    </svg>`,
  },
  {
    id: 'anime-zhuang',
    group: 'Anime',
    name: 'Zhuang Fangyi',
    desc: 'Endfield - verde profundo - vermelho seco',
    preview: ['#050c07', '#54c77a', '#9a3d3d'],
    accent: '#54c77a',
    orb1: 'rgba(22,82,48,.28)',
    orb2: 'rgba(94,31,31,.20)',
    bg: '#050c07',
    bgImage: 'zhuang',
    surface: 'rgba(4,12,7,.78)',
    border: 'rgba(84,199,122,.16)',
    logoIcon: `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="13" fill="#040e06" stroke="#1a6640" stroke-width=".7"/>
      <path d="M11 6 C10 3 8 2 9 1" stroke="#8b1a1a" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M17 6 C18 3 20 2 19 1" stroke="#8b1a1a" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M10 8 C9 10 8 13 9 17 L14 20 L19 17 C20 13 19 10 18 8 C17 7 15 6.5 14 6.5 C13 6.5 11 7 10 8 Z"
        fill="#082a14" stroke="#1a6640" stroke-width=".5"/>
      <path d="M11 10 L14 11.5 L17 10" stroke="#8b1a1a" stroke-width=".8" stroke-linecap="round"/>
      <path d="M7 14 C5 12 4 14 6 15 C4 16 5 18 7 16" stroke="#00e066" stroke-width=".7" stroke-linecap="round" opacity=".8"/>
      <path d="M21 14 C23 12 24 14 22 15 C24 16 23 18 21 16" stroke="#00e066" stroke-width=".7" stroke-linecap="round" opacity=".8"/>
      <circle cx="12" cy="12" r=".9" fill="#c8735a"/>
      <circle cx="16" cy="12" r=".9" fill="#c8735a"/>
      <circle cx="12.3" cy="11.7" r=".3" fill="#ff9999" opacity=".7"/>
      <circle cx="16.3" cy="11.7" r=".3" fill="#ff9999" opacity=".7"/>
    </svg>`,
    runIcon: `<svg style="width:16px;height:16px" viewBox="0 0 16 16" fill="none">
      <polygon points="8,1 13.2,4 13.2,10 8,13 2.8,10 2.8,4"
        fill="#00cc55" stroke="#a0ffb8" stroke-width=".5" opacity=".95"/>
      <line x1="8" y1="3.5" x2="8" y2="10.5" stroke="#040e06" stroke-width=".9" stroke-linecap="round"/>
      <line x1="4.5" y1="7" x2="11.5" y2="7" stroke="#040e06" stroke-width=".9" stroke-linecap="round"/>
      <circle cx="3"  cy="5"  r=".7" fill="#00cc55" opacity=".6"/>
      <circle cx="13" cy="4"  r=".6" fill="#00cc55" opacity=".5"/>
      <circle cx="12" cy="10" r=".7" fill="#4aff8c" opacity=".5"/>
    </svg>`,
  },
  {
    id: 'anime-seinen',
    group: 'Anime',
    name: 'Seinen',
    desc: 'Manga - hachuras - papel editorial',
    preview: ['#f2ecdf', '#161616', '#6b6257'],
    accent: '#111111',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#f2ecdf',
    surface: 'rgba(255,255,255,.68)',
    border: 'rgba(0,0,0,.18)',
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

  // Fundo e superfície.
  root.style.setProperty('--color-bg-page',  t.bg      || '#07080f');
  root.style.setProperty('--color-surface',  t.surface || 'rgba(255,255,255,.04)');
  root.style.setProperty('--color-border',   t.border  || 'rgba(255,255,255,.08)');

  // Imagem de fundo
  const _bgMap = { ssj: VEGITO_SSJ_BG, blue: VEGITO_BLUE_BG, lastrite: LAST_RITE_BG, zhuang: ZHUANG_BG, true: VEGITO_BLUE_BG };
  const _bgUrl = _bgMap[t.bgImage] || null;
  const _bgPositionMap = {
    ssj:      'center top',
    blue:     'center top',
    lastrite: 'center top',
    zhuang:   'center top',
  };
  if (_bgUrl) {
    const _overlay = 'linear-gradient(rgba(0,0,0,.16),rgba(0,0,0,.28)), ';
    document.body.style.backgroundImage    = `${_overlay}url(${_bgUrl})`;
    document.body.style.backgroundSize     = 'cover';
    document.body.style.backgroundPosition = _bgPositionMap[t.bgImage] || 'center top';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat   = 'no-repeat';
  } else {
    document.body.style.backgroundImage    = '';
    document.body.style.backgroundSize     = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    document.body.style.backgroundRepeat   = '';
  }

  // Temas claros (Seinen) - ajusta texto e sidebar
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

  // Hachuras Seinen no body
  document.body.classList.toggle('theme-seinen', !!t.isLight);

  // Botao de gelo - Last Rite
  const runBtn = document.querySelector('.run-btn');
  if (t.id === 'anime-last-rite' && runBtn) {
    runBtn.dataset.iceActive = '1';
  } else if (runBtn && runBtn.dataset.iceActive) {
    delete runBtn.dataset.iceActive;
  }

  // Trincas de gelo - Last Rite
  document.body.classList.toggle('theme-last-rite', t.id === 'anime-last-rite');
  let _iceEl = document.getElementById('_iceCrack');
  if (t.id === 'anime-last-rite') {
    if (!_iceEl) {
      _iceEl = document.createElement('div');
      _iceEl.id = '_iceCrack';
      _iceEl.style.cssText = 'position:fixed;top:0;right:0;width:200px;height:200px;pointer-events:none;z-index:0;opacity:.07';
      _iceEl.innerHTML = `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
        <path d="M200 0 L140 60 L165 80 L110 140 L135 165 L70 200" stroke="white" stroke-width="1.5"/>
        <path d="M185 0 L148 37 L168 52 L128 95" stroke="white" stroke-width=".9" opacity=".6"/>
        <path d="M165 65 L188 78 M140 100 L168 90" stroke="white" stroke-width=".7" opacity=".5"/>
        <path d="M200 30 L175 55 L190 65 L160 95 L178 112" stroke="white" stroke-width=".6" opacity=".4"/>
        <path d="M155 80 L170 72 M148 115 L162 108" stroke="white" stroke-width=".5" opacity=".35"/>
      </svg>`;
      document.body.appendChild(_iceEl);
    }
    _iceEl.style.display = '';
  } else if (_iceEl) {
    _iceEl.style.display = 'none';
  }

  // Fragmentos de cristal verde - Zhuang Fangyi
  document.body.classList.toggle('theme-zhuang', t.id === 'anime-zhuang');
  let _zhuangCrystal = document.getElementById('_zhuangCrystal');
  if (t.id === 'anime-zhuang') {
    if (!_zhuangCrystal) {
      _zhuangCrystal = document.createElement('div');
      _zhuangCrystal.id = '_zhuangCrystal';
      _zhuangCrystal.style.cssText = 'position:fixed;bottom:0;right:0;width:220px;height:220px;pointer-events:none;z-index:0;opacity:.09';
      _zhuangCrystal.innerHTML = `<svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M220 220 L160 140 L200 120 L140 60 L180 40 L110 0" stroke="#00cc55" stroke-width="1.4"/>
        <path d="M210 220 L165 155 L195 138 L148 88" stroke="#00cc55" stroke-width=".9" opacity=".6"/>
        <path d="M155 145 L175 135 M138 100 L158 90" stroke="#4aff8c" stroke-width=".7" opacity=".55"/>
        <polygon points="170,170 185,155 195,175 180,185" fill="#00cc55" opacity=".25"/>
        <polygon points="140,120 150,105 162,122 150,135" fill="#00cc55" opacity=".2"/>
        <polygon points="195,100 205,88 215,103 205,115" fill="#4aff8c" opacity=".18"/>
        <circle cx="170" cy="170" r="3" fill="#00e066" opacity=".5"/>
        <circle cx="148" cy="90"  r="2" fill="#4aff8c" opacity=".45"/>
        <circle cx="200" cy="125" r="1.5" fill="#00cc55" opacity=".4"/>
      </svg>`;
      document.body.appendChild(_zhuangCrystal);
    }
    _zhuangCrystal.style.display = '';
  } else if (_zhuangCrystal) {
    _zhuangCrystal.style.display = 'none';
  }

  try { localStorage.setItem(LS_THEME, t.id); } catch {}
}

// Aplicado separadamente para não bloquear o restore() antes do DOM carregar.
function _applyDomTheme(t) {
  // Logo icon
  const logoEl = document.querySelector('.logo-icon');
  if (logoEl) {
    if (t.logoIcon) {
      logoEl.innerHTML = t.logoIcon;
      logoEl.style.overflow = 'hidden';
      logoEl.style.padding = '0';
    } else {
      logoEl.innerHTML = '';
      logoEl.textContent = 'F';
      logoEl.style.overflow = '';
      logoEl.style.padding = '';
    }
  }

  // Botao run
  const runIconEl = document.querySelector('.run-icon');
  if (runIconEl) {
    if (t.runIcon) {
      runIconEl.innerHTML = t.runIcon + ' Processar Ficha';
    } else {
      runIconEl.textContent = 'Processar Ficha';
    }
  }

  // Placeholder
  const phImg  = document.getElementById('placeholderImg');
  const phIcon = document.getElementById('placeholderIcon');
  const isVegitoAnime = (t.id === 'anime-vegito-ssj' || t.id === 'anime-vegito-blue');
  const isSerenity    = t.id === 'anime-serenity';
  const isLastRite    = t.id === 'anime-last-rite';
  const isZhuang      = t.id === 'anime-zhuang';

  // Placeholder - estrela SVG para Serenity, chibi Last Rite, imagem Vegito para os outros
  const phStar = document.getElementById('placeholderStar');

  if (phImg && phIcon) {
    if (isVegitoAnime) {
      const phFilter = t.id === 'anime-vegito-ssj'
        ? 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.15)'
        : 'sepia(1) saturate(5) hue-rotate(175deg) brightness(1.1)';
      phImg.style.cssText = 'display:block;width:180px;height:auto;margin:0 auto;opacity:.6;filter:' + phFilter;
      phImg.src = GOKU_PH_IMG;
      phIcon.style.display = 'none';
      if (phStar) phStar.style.display = 'none';
    } else if (isLastRite) {
      phImg.style.cssText = 'display:block;width:200px;height:auto;margin:0 auto;opacity:.75;filter:drop-shadow(0 0 12px rgba(74,166,255,.5))';
      phImg.src = LAST_RITE_PH;
      phIcon.style.display = 'none';
      if (phStar) phStar.style.display = 'none';
    } else if (isZhuang) {
       phImg.src = '../assets/img/zhuang_fangyi_chibi.png'; // imagem que quiser
  phImg.style.cssText = 'display:block;width:220px;height:auto;margin:0 auto;opacity:.85;filter:drop-shadow(0 0 16px rgba(0,204,85,.6))';
  phIcon.style.display = 'none';
      if (phStar) phStar.style.display = 'none';
    } else if (isSerenity) {
      phImg.src = '';
      phImg.style.cssText = 'display:none';
      phIcon.style.display = 'none';
      if (phStar) phStar.style.display = '';
    } else {
      phImg.src = '';
      phImg.style.cssText = 'display:none';
      phIcon.style.display = '';
      if (phStar) phStar.style.display = 'none';
    }
  }
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
          <span class="modal-title">&#127912; Aparência do site</span>
          <button class="modal-close" id="themeModalClose">&times;</button>
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
          <div class="theme-check">&#10003;</div>`;
        card.addEventListener('click', () => {
          overlay.querySelectorAll('.theme-card').forEach(c => c.classList.remove('theme-card--active'));
          card.classList.add('theme-card--active');
          applyTheme(t);
          _applyDomTheme(t);
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

  // Chamado após o DOM do app estar visível (após login).
  restoreDom() {
    try {
      const id = localStorage.getItem(LS_THEME) || 'dark-glass';
      const t  = THEMES.find(t => t.id === id) || THEMES[0];
      _applyDomTheme(t);
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
      btn.textContent = open ? '<' : 'Cat';
      btn.title       = open ? 'Fechar painel de categorias' : 'Abrir painel de categorias';
    }
    try { localStorage.setItem('sb_open', open ? '1' : '0'); } catch {}
  },

  restore() {
    try {
      const saved = localStorage.getItem('sb_open');
      if (saved === '0') {
        // Começa aberto por padrão; fecha se estiver salvo como '0'.
        this.toggle();
      } else {
        AppState.sidebar.open = true;
        $('appLayout')?.classList.remove('sidebar-collapsed');
        $('appHeader')?.classList.remove('sidebar-collapsed');
        const btn = $('sidebarToggle');
        if (btn) { btn.textContent = '<'; btn.title = 'Fechar painel de categorias'; }
      }
    } catch {}
  },
};

/**
 * ConfigModal - modal de configuração de APIs e modelo.
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
          <span class="modal-title">&#9881; Configuração de APIs</span>
          <button class="modal-close" id="configModalClose">&times;</button>
        </div>
        <div class="modal-body" style="gap:20px">

          <div class="setup-grid">
            <div class="field">
              <label>API Key do Gemini <span style="color:var(--color-success);font-weight:400">&middot; A2 e A3</span></label>
              <div class="key-wrap" id="apiKeySlot"><span class="key-status" id="keyStatus"></span></div>
              <div class="hint">Obtenha grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a></div>
            </div>
            <div class="field">
              <label>API Key da Mistral <span style="color:var(--color-success);font-weight:400">&middot; A1</span></label>
              <div class="key-wrap" id="mistralKeySlot"><span class="key-status" id="mistralKeyStatus"></span></div>
              <div class="hint">Grátis em <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener">console.mistral.ai</a> &mdash; sem cartão &middot; usado no A1 (Formatador)</div>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Modelo Gemini</label>
              <div id="modelSelSlot"></div>
              <div class="hint" id="modelHint"></div>
            </div>
            <div class="field">
              <label>Modo de processamento</label>
              <select id="pipelineModeSel">
                <option value="quality">Qualidade (A1 + A2 + A3 opcional)</option>
              </select>
              <div class="hint">Mantém conferência separada para preservar qualidade.</div>
            </div>
            <div class="field">
              <label>Conteúdo comercial</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--color-text-secondary);font-weight:500">
                <input type="checkbox" id="autoA3Check" style="width:auto">
                Gerar A3 automaticamente
              </label>
              <div class="hint">Desative para economizar 1 chamada por ficha e gerar depois pelo botão.</div>
            </div>
          </div>

          <div class="config-section-divider">
            <span>Chaves de Fallback</span>
            <div class="hint" style="margin-top:4px">Acionadas automaticamente quando a chave primária retornar 503, 529 ou sobrecarga.</div>
          </div>

          <div class="setup-grid">
            <div class="field">
              <label>Gemini &mdash; Chave 2 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap" id="apiKey2Slot"><span class="key-status" id="keyStatus2"></span></div>
            </div>
            <div class="field">
              <label>Mistral &mdash; Chave 2 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap" id="mistralKey2Slot"><span class="key-status" id="mistralKeyStatus2"></span></div>
            </div>
            <div class="field">
              <label>Gemini &mdash; Chave 3 <span class="fallback-badge">fallback</span></label>
              <div class="key-wrap" id="apiKey3Slot"><span class="key-status" id="keyStatus3"></span></div>
            </div>
          </div>
      </div>`;

    document.body.appendChild(overlay);

    // Ativa os eventos do painel SerpAPI.
    initSerpConfig();

    // Move os inputs reais para o modal sem duplicá-los; api.js continua encontrando os mesmos IDs.
    const moveToSlot = (inputId, slotId) => {
      const input = document.getElementById(inputId);
      const slot  = document.getElementById(slotId);
      if (input && slot) slot.prepend(input);
    };
    moveToSlot('apiKey',     'apiKeySlot');
    moveToSlot('mistralKey', 'mistralKeySlot');
    moveToSlot('modelSel',   'modelSelSlot');

    // Cria e move inputs de fallback; eles ficam visíveis somente neste modal.
    this._ensureFallbackInputs();
    moveToSlot('apiKey2',    'apiKey2Slot');
    moveToSlot('apiKey3',    'apiKey3Slot');
    moveToSlot('mistralKey2','mistralKey2Slot');

    // Atualizar hint do modelo
    const hints = {
      'gemini-2.5-flash-lite': 'Recomendado - maior cota diária gratuita',
      'gemini-2.5-flash':      'Boa qualidade, cota intermediária',
      'gemini-2.5-pro':        'Apenas 100 req/dia - use para tarefas que exigem mais raciocínio',
    };
    const modelEl = document.getElementById('modelSel');
    const hintEl  = document.getElementById('modelHint');
    if (modelEl && hintEl) hintEl.textContent = hints[modelEl.value] || '';
    const pipelineModeEl = document.getElementById('pipelineModeSel');
    const autoA3El = document.getElementById('autoA3Check');
    try {
      if (pipelineModeEl) pipelineModeEl.value = localStorage.getItem('fastseo_pipeline_mode') || 'quality';
      if (autoA3El) autoA3El.checked = localStorage.getItem('fastseo_auto_a3') !== '0';
    } catch {}

    // Listeners
    document.getElementById('apiKey')?.addEventListener('input',     () => { ConfigUI.validateGeminiKey();  this._showSaved(); });
    document.getElementById('mistralKey')?.addEventListener('input', () => { ConfigUI.validateMistralKey(); this._showSaved(); });
    document.getElementById('modelSel')?.addEventListener('change',  () => {
      ConfigUI.updateQuotaInfo();
      if (hintEl) hintEl.textContent = hints[modelEl?.value] || '';
      this._showSaved();
    });
    pipelineModeEl?.addEventListener('change', () => {
      try { localStorage.setItem('fastseo_pipeline_mode', pipelineModeEl.value || 'quality'); } catch {}
      this._showSaved();
    });
    autoA3El?.addEventListener('change', () => {
      try { localStorage.setItem('fastseo_auto_a3', autoA3El.checked ? '1' : '0'); } catch {}
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
        if (st) st.textContent = ok ? 'OK' : 'X';
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

