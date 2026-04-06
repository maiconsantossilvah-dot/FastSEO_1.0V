/**
 * components/ConfigUI.js
 * ───────────────────────
 * Gerencia a UI de configuração: API keys, modelo e contador de caracteres.
 */

import { Quota } from '../modules/quota.js';

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
import { AppState } from '../modules/state.js';

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
