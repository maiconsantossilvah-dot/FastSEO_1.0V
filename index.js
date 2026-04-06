/**
 * utils/index.js
 * ───────────────
 * Funções utilitárias puras (sem efeitos colaterais nem dependências de módulos do app).
 */

import { APP_CONFIG } from './config.js';

export const Utils = {
  // ─── Segurança / sanitização ───────────────────────────────
  escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  sanitize(t) {
    t = t
      .replace(/<[^>]+>/g, '')
      .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/(javascript:|data:|vbscript:)/gi, '')
      .replace(/ {3,}/g, '  ')
      .trim();
    if (t.length > APP_CONFIG.inputMaxChars) {
      // PipelineUI.log é importado circularmente; usa console para evitar ciclo
      console.warn(`Input truncado para ${APP_CONFIG.inputMaxChars} caracteres.`);
      t = t.slice(0, APP_CONFIG.inputMaxChars);
    }
    return t;
  },

  // ─── Detecção de bivolt ────────────────────────────────────
  detectBivolt(text) {
    return /(?<!\d)(110|127)\s*[vV](?!\d)/.test(text)
        && /(?<!\d)(220|240)\s*[vV](?!\d)/.test(text);
  },

  // ─── Validação de input ────────────────────────────────────
  validateInput(text) {
    const alerts = [];
    if (text.length < 80)
      alerts.push('⚠ Input muito curto — verifique se os dados foram colados corretamente.');
    if (!/\d/.test(text))
      alerts.push('⚠ Nenhum dado numérico encontrado — fichas técnicas geralmente têm códigos ou medidas.');
    if (text.split('\n').filter(l => l.trim()).length < 3)
      alerts.push('⚠ Poucas linhas de dados — o conteúdo pode estar incompleto.');
    return alerts;
  },

  // ─── Few-shot builder ──────────────────────────────────────
  buildFewShot(bivolt, cats) {
    const MAX_CHARS   = 6000;
    const validCats   = (cats || []).filter(c => c.ficha || c.campos || c.copy);
    if (!validCats.length) return '';

    const header = '\n\n── EXEMPLOS E PADRÕES DA EMPRESA ──\nUse os exemplos abaixo como referência de formato, campos prioritários e tom. Adapte ao produto atual.\n\n';
    let bloco = header, len = 0;
    const limit = MAX_CHARS - header.length;

    for (const cat of validCats) {
      let parte = `=== CATEGORIA: ${cat.nome} ===\n`;
      if (cat.campos) parte += `Campos prioritários:\n${cat.campos}\n\n`;
      if (cat.ficha)  parte += `Exemplo de ficha ideal:\n${cat.ficha}\n\n`;
      if (cat.copy && !bivolt) parte += `Exemplo de conteúdo comercial:\n${cat.copy}\n\n`;
      parte += '---\n';
      if (len + parte.length > limit) {
        bloco += '(demais categorias omitidas por limite de tamanho)\n';
        break;
      }
      bloco += parte;
      len   += parte.length;
    }
    return bloco;
  },

  // ─── Matching de categorias ────────────────────────────────
  matchCategories(input, allCats = []) {
    const validCats  = allCats.filter(c => c.ficha || c.campos || c.copy);
    const inputLower = input.toLowerCase();

    return validCats.filter(cat => {
      const nome          = cat.nome.toLowerCase().trim();
      const nomeSemHifen  = nome.replace(/-/g, ' ');
      const inputSemHifen = inputLower.replace(/-/g, ' ');

      const rePhrase = new RegExp(
        '(?<![\\w\\u00C0-\\u024F])' +
        nomeSemHifen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '(?![\\w\\u00C0-\\u024F])'
      );
      if (rePhrase.test(inputSemHifen)) return true;

      const unica = !nome.includes(' ') && !nome.includes('-');
      if (unica && nome.length >= 4) {
        const reWord = new RegExp(
          '(?<![\\w\\u00C0-\\u024F])' +
          nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '(?![\\w\\u00C0-\\u024F])'
        );
        return reWord.test(inputLower);
      }
      return false;
    });
  },

  // ─── Toast helper ──────────────────────────────────────────
  showToast(msg, color = '#059669') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:700;background:${color};color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2);animation:fadeIn .2s ease;font-family:var(--font-body);white-space:nowrap;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  },

  // ─── Clipboard ────────────────────────────────────────────
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback para navegadores sem Clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  },
};
