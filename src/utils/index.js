/**
 * utils/index.js
 * ---------------
 * Funções utilitárias puras (sem efeitos colaterais nem dependências de módulos do app).
 */

import { APP_CONFIG } from '../config.js';
import {
  hasCategoryDefinition,
  normalizeCategory,
} from '../modules/categoryQaSchema.js';
import { rankMatches } from './matching.js';

export const Utils = {
  // Segurança / sanitização
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
      // PipelineUI.log é importado circularmente; usa console para evitar ciclo.
      console.warn(`Input truncado para ${APP_CONFIG.inputMaxChars} caracteres.`);
      t = t.slice(0, APP_CONFIG.inputMaxChars);
    }
    return t;
  },

  // Detecção de bivolt
  detectBivolt(text) {
    return /(?<!\d)(110|127)\s*[vV](?!\d)/.test(text)
        && /(?<!\d)(220|240)\s*[vV](?!\d)/.test(text);
  },

  // Validação leve: só alerta o usuário; não bloqueia quando ele escolhe "processar mesmo assim".
  validateInput(text) {
    const alerts = [];
    if (text.length < 80)
      alerts.push('Atenção: input muito curto - verifique se os dados foram colados corretamente.');
    if (!/\d/.test(text))
      alerts.push('Atenção: nenhum dado numérico encontrado - fichas técnicas geralmente têm códigos ou medidas.');
    if (text.split('\n').filter(l => l.trim()).length < 3)
      alerts.push('Atenção: poucas linhas de dados - o conteúdo pode estar incompleto.');
    return alerts;
  },

  // Few-shot builder
  buildFewShot(bivolt, cats) {
    const MAX_CHARS   = 2200;
    const validCats   = (cats || []).filter(hasCategoryDefinition).map(normalizeCategory).slice(0, 1);
    if (!validCats.length) return '';

    const header = '\n\n-- CATEGORIA SELECIONADA (estrutura, nunca fonte factual) --\n';
    let bloco = header, len = 0;
    const limit = MAX_CHARS - header.length;

    for (const cat of validCats) {
      let parte = `Categoria: ${cat.nome}\n`;
      const obrigatorios = cat.camposObrigatorios.join('; ');
      const opcionais = cat.camposOpcionais.join('; ');
      if (obrigatorios) parte += `Obrigatórios: ${obrigatorios}\n`;
      if (opcionais) parte += `Opcionais: ${opcionais}\n`;

      const skeleton = String(cat.fichaIdeal || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const index = line.indexOf(':');
          if (index < 0) return '';
          const field = line.slice(0, index + 1).trim();
          return line.slice(index + 1).trim() ? `${field} <valor>` : field;
        })
        .filter((line, index, all) => line && all.indexOf(line) === index)
        .join('\n');

      if (skeleton) parte += `Esqueleto visual:\n${skeleton}\n`;
      if (len + parte.length > limit) {
        bloco += parte.slice(0, Math.max(0, limit - len)).trimEnd();
        break;
      }
      bloco += parte;
      len   += parte.length;
    }
    return bloco;
  },

  // Matching de categorias
  /**
   * Pontua categorias pelo produto principal, não pelo contexto de uso.
   * Ex: "Tela plastica para ar condicionado" deve priorizar "Tela",
   * enquanto "Ar Condicionado Split Philco" deve priorizar "Ar Condicionado".
   */
  matchCategories(input, allCats = []) {
    const validCats = allCats.filter(hasCategoryDefinition).map(normalizeCategory);
    const aliases = validCats.flatMap(category => {
      const names = [category.nome, ...(category.aliases || [])].filter(Boolean);
      return [...new Set(names)].map(name => ({ category, name }));
    });
    const seen = new Set();
    return rankMatches(input, aliases, item => item.name, { scope: 'full' })
      .map(match => match.item.category)
      .filter(category => !seen.has(category.id) && seen.add(category.id));
  },

  showToast(msg, color = '#059669') {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:700;background:${color};color:#fff;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.2);animation:fadeIn .2s ease;font-family:var(--font-body);white-space:nowrap;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  },

  // Clipboard
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

