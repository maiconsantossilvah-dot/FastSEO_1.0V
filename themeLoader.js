const LS_THEME = 'fastseo_theme';

const THEME_SHELLS = {
  'glass-indigo': {
    accent: '#6366f1',
    orb1: '#4f46e5',
    orb2: '#7c3aed',
    bg: '#07080f',
  },
  'glass-cyan': {
    accent: '#06b6d4',
    orb1: '#0e7490',
    orb2: '#065f46',
    bg: '#050e12',
  },
  'solid-charcoal': {
    accent: '#3b82f6',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#141517',
    surface: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.1)',
  },
  'solid-graphite': {
    accent: '#22c55e',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#0d0d0d',
    surface: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.09)',
  },
  'solid-navy': {
    accent: '#58a6ff',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#0d1117',
    surface: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.1)',
  },
  'solid-espresso': {
    accent: '#d97706',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#130e06',
    surface: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.09)',
  },
  'neutral-zinc': {
    accent: '#71717a',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#18181b',
    surface: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.08)',
  },
  'neutral-stone': {
    accent: '#a8a29e',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#1c1917',
    surface: 'rgba(255,255,255,.04)',
    border: 'rgba(255,255,255,.08)',
  },
  'neutral-void': {
    accent: '#525252',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#000000',
    surface: 'rgba(255,255,255,.03)',
    border: 'rgba(255,255,255,.07)',
  },
  'anime-vegito-ssj': {
    accent: '#d99a2b',
    orb1: 'rgba(217,154,43,.28)',
    orb2: 'rgba(160,75,28,.22)',
    bg: '#070507',
    surface: 'rgba(12,8,5,.78)',
    border: 'rgba(217,154,43,.18)',
    bgImage: './Img/vegito-ssj-bg.jpg',
  },
  'anime-vegito-blue': {
    accent: '#3fb6d9',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#03080d',
    surface: 'rgba(3,10,16,.78)',
    border: 'rgba(63,182,217,.2)',
    bgImage: './Img/vegito-blue-bg.jpg',
  },
  'anime-serenity': {
    accent: '#c6a6d9',
    orb1: 'rgba(126,98,160,.34)',
    orb2: 'rgba(44,35,82,.28)',
    bg: '#06060f',
    surface: 'rgba(16,12,28,.72)',
    border: 'rgba(198,166,217,.18)',
  },
  'anime-last-rite': {
    accent: '#74b7e6',
    orb1: 'rgba(56,111,166,.24)',
    orb2: 'rgba(108,37,54,.18)',
    bg: '#040810',
    surface: 'rgba(4,10,18,.78)',
    border: 'rgba(116,183,230,.18)',
    bgImage: './Img/last-rite-bg.webp',
  },
  'anime-zhuang': {
    accent: '#54c77a',
    orb1: 'rgba(22,82,48,.28)',
    orb2: 'rgba(94,31,31,.20)',
    bg: '#050c07',
    surface: 'rgba(4,12,7,.78)',
    border: 'rgba(84,199,122,.16)',
    bgImage: './Img/zhuang-fangyi.jpg',
  },
  'anime-seinen': {
    accent: '#111111',
    orb1: 'transparent',
    orb2: 'transparent',
    bg: '#f2ecdf',
    surface: 'rgba(255,255,255,.68)',
    border: 'rgba(0,0,0,.18)',
    isLight: true,
  },
};

function setVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

export function getSavedThemeId() {
  try { return localStorage.getItem(LS_THEME) || 'glass-indigo'; }
  catch { return 'glass-indigo'; }
}

export function applySavedThemeShell() {
  const id = getSavedThemeId();
  const t = THEME_SHELLS[id] || THEME_SHELLS['glass-indigo'];
  const root = document.documentElement;

  root.setAttribute('data-theme-id', id);
  root.setAttribute('data-theme', t.isLight ? 'light' : 'dark');

  setVar('--color-accent', t.accent);
  setVar('--color-accent-hover', `${t.accent}dd`);
  setVar('--color-accent-bg', `${t.accent}1a`);
  setVar('--color-accent-glow', `${t.accent}35`);
  setVar('--orb1-color', t.orb1 || 'transparent');
  setVar('--orb2-color', t.orb2 || 'transparent');
  setVar('--color-bg-page', t.bg || '#07080f');
  setVar('--color-surface', t.surface || 'rgba(255,255,255,.04)');
  setVar('--color-border', t.border || 'rgba(255,255,255,.08)');
  setVar('--logo-glow', t.orb1 && t.orb1 !== 'transparent' ? `0 0 20px ${t.accent}80` : 'none');

  if (t.isLight) {
    setVar('--color-text-primary', '#111111');
    setVar('--color-text-secondary', '#444444');
    setVar('--color-text-muted', 'rgba(0,0,0,.4)');
    setVar('--color-sidebar-bg', 'rgba(240,235,224,.95)');
    setVar('--color-header-bg', 'rgba(17,17,17,.97)');
    setVar('--color-log-bg', '#111111');
    setVar('--color-success', '#166534');
    setVar('--color-danger', '#991b1b');
    setVar('--color-warn', '#92400e');
    setVar('--seinen-hatching', '1');
  } else {
    setVar('--color-text-primary', '#e2e8f0');
    setVar('--color-text-secondary', '#94a3b8');
    setVar('--color-text-muted', 'rgba(255,255,255,.3)');
    setVar('--color-sidebar-bg', 'rgba(5,6,12,.7)');
    setVar('--color-header-bg', 'rgba(7,8,15,.85)');
    setVar('--color-log-bg', 'rgba(0,0,0,.5)');
    setVar('--color-success', '#4ade80');
    setVar('--color-danger', '#f87171');
    setVar('--color-warn', '#fbbf24');
    setVar('--seinen-hatching', '0');
  }

  document.body?.classList.toggle('theme-seinen', !!t.isLight);
  document.body?.classList.toggle('theme-last-rite', id === 'anime-last-rite');
  document.body?.classList.toggle('theme-zhuang', id === 'anime-zhuang');

  if (document.body) {
    if (t.bgImage) {
      document.body.style.backgroundImage = `url(${t.bgImage})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center top';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.backgroundRepeat = 'no-repeat';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
      document.body.style.backgroundRepeat = '';
    }
  }
}
