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
  /**
   * Determina se o input é SOBRE esta categoria.
   *
   * Regras:
   *  1. Usa a primeira linha do input como âncora (título do produto).
   *  2. O nome da categoria deve aparecer nas primeiras (N+1) palavras
   *     da âncora, onde N = número de palavras do nome.
   *  3. Não pode ser precedido por preposição (evita falsos positivos
   *     como "TV" em "Cabo de TV", "Notebook" em "Mochila para Notebook").
   *  4. Quando duas categorias batem e uma é prefixo da outra,
   *     mantém apenas a mais específica ("Impressora Térmica" > "Impressora").
   */
  matchCategories(input, allCats = []) {
    const validCats = allCats.filter(c => c.ficha || c.campos || c.copy);

    // Normaliza removendo acentos, hifens e barras
    const norm = s => s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[-\/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const PREPOS   = /\b(de|do|da|dos|das|para|com|por|em|no|na|nos|nas|e)\s+$/i;
    const STOP_INI = /^(o|a|os|as|um|uma|uns|umas|novo|nova)\s+/i;

    const primeiraLinha = input.split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
    const ancoraNorm    = norm(primeiraLinha).slice(0, 150).replace(STOP_INI, '');
    const palavrasAnc   = ancoraNorm.split(/\s+/);

    // Primeiro passo: coleta todos que batem
    const candidatos = validCats.filter(cat => {
      const nome         = norm(cat.nome);
      const palavrasNome = nome.split(/\s+/);
      const janela       = palavrasAnc.slice(0, palavrasNome.length + 1).join(' ');
      const re           = new RegExp('(?<![\\w])' + reEscape(nome) + '(?![\\w])');
      if (!re.test(janela)) return false;
      const idx = janela.search(re);
      if (idx > 0 && PREPOS.test(janela.slice(0, idx))) return false;
      return true;
    });

    // Segundo passo: remove os menos específicos quando um mais específico
    // já cobre o mesmo prefixo (ex: remove "Impressora" se "Impressora Térmica" bateu)
    return candidatos.filter(cat => {
      const nomeNorm = norm(cat.nome);
      return !candidatos.some(outro => {
        if (outro === cat) return false;
        const outroNorm = norm(outro.nome);
        // outro é mais específico e começa com o nome de cat
        return outroNorm.startsWith(nomeNorm + ' ') && outroNorm.length > nomeNorm.length;
      });
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
