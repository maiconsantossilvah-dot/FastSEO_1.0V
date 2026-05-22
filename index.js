/**
 * utils/index.js
 * ---------------
 * Funcoes utilitarias puras (sem efeitos colaterais nem dependencias de modulos do app).
 */

import { APP_CONFIG } from './config.js';

export const Utils = {
  // Seguranca / sanitizacao
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
      // PipelineUI.log e importado circularmente; usa console para evitar ciclo
      console.warn(`Input truncado para ${APP_CONFIG.inputMaxChars} caracteres.`);
      t = t.slice(0, APP_CONFIG.inputMaxChars);
    }
    return t;
  },

  // Deteccao de bivolt
  detectBivolt(text) {
    return /(?<!\d)(110|127)\s*[vV](?!\d)/.test(text)
        && /(?<!\d)(220|240)\s*[vV](?!\d)/.test(text);
  },

  // Validacao de input
  validateInput(text) {
    const alerts = [];
    if (text.length < 80)
      alerts.push('Atencao: input muito curto - verifique se os dados foram colados corretamente.');
    if (!/\d/.test(text))
      alerts.push('Atencao: nenhum dado numerico encontrado - fichas tecnicas geralmente tem codigos ou medidas.');
    if (text.split('\n').filter(l => l.trim()).length < 3)
      alerts.push('Atencao: poucas linhas de dados - o conteudo pode estar incompleto.');
    return alerts;
  },

  // Few-shot builder
  buildFewShot(bivolt, cats) {
    const MAX_CHARS   = 6000;
    const validCats   = (cats || []).filter(c => c.ficha || c.campos || c.copy);
    if (!validCats.length) return '';

    const header = '\n\n-- EXEMPLOS E PADROES DA EMPRESA --\nUse os exemplos abaixo como referencia de formato, campos prioritarios e tom. Adapte ao produto atual.\n\n';
    let bloco = header, len = 0;
    const limit = MAX_CHARS - header.length;

    for (const cat of validCats) {
      let parte = `=== CATEGORIA: ${cat.nome} ===\n`;
      if (cat.campos) parte += `Campos prioritarios:\n${cat.campos}\n\n`;
      if (cat.ficha)  parte += `Exemplo de ficha ideal:\n${cat.ficha}\n\n`;
      if (cat.copy && !bivolt) parte += `Exemplo de conteudo comercial:\n${cat.copy}\n\n`;
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

  // Matching de categorias
  /**
   * Determina se o input e SOBRE esta categoria.
   *
   * Regras:
   *  1. Encontra a "linha ancora" - a primeira linha que parece ser
   *     o nome/titulo do produto, pulando linhas de codigo, EAN,
   *     fornecedor, marca isolada, etc.
   *  2. O nome da categoria deve aparecer nas primeiras (N+1) palavras
   *     da ancora (N = palavras do nome), com tolerancia de 1 qualificador.
   *  3. Nao pode ser precedido por preposicao.
   *  4. Quando duas categorias batem e uma e prefixo da outra,
   *     mantem apenas a mais especifica.
   */
  matchCategories(input, allCats = []) {
    const validCats = allCats.filter(c => c.ficha || c.campos || c.copy);

    const norm = s => String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[-/]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const stopWords = new Set(['o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','para','com','por','em','no','na','nos','nas','e']);
    const tokenize = s => norm(s).split(' ').filter(t => t && !stopWords.has(t));
    const hasAllTokens = (tokens, wanted) => wanted.every(t => tokens.includes(t));
    const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasPhrase = (text, phrase) => new RegExp(`(?:^|\\s)${escapeRe(phrase)}(?:\\s|$)`).test(text);

    const isLinhaRuido = line => {
      const semEspaco = line.replace(/\s/g, '');
      if (!semEspaco.length) return true;
      if ((semEspaco.match(/\d/g) || []).length / semEspaco.length > 0.5) return true;
      if (/\b(ean|ncm|gtin|sku)\b/i.test(line)) return true;
      if (/^\s*(fornecedor|marca|ref|cod|codigo|cod\.|fabricante|modelo|origem)\s*:/i.test(norm(line))) return true;
      return false;
    };

    const linhas = input.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10);
    const linhasUteis = linhas.filter(l => !isLinhaRuido(l) && l.replace(/\d/g, '').trim().length >= 4);
    const textoTitulo = norm(linhasUteis.slice(0, 3).join(' ') || linhas[0] || '');
    const textoGeral = norm(input).slice(0, 1200);
    const tokensTitulo = tokenize(textoTitulo);
    const tokensGeral = tokenize(textoGeral);

    const scored = validCats.map(cat => {
      const nome = norm(cat.nome);
      const catTokens = tokenize(cat.nome);
      if (!nome || !catTokens.length) return null;

      const titleHits = catTokens.filter(t => tokensTitulo.includes(t)).length;
      const geralHits = catTokens.filter(t => tokensGeral.includes(t)).length;
      const titleRatio = titleHits / catTokens.length;
      const geralRatio = geralHits / catTokens.length;
      const exactTitle = hasPhrase(textoTitulo, nome);
      const exactGeral = hasPhrase(textoGeral, nome);

      let score = 0;
      if (exactTitle) score += 80;
      else if (hasAllTokens(tokensTitulo, catTokens)) score += 58;
      else if (catTokens.length > 1 && titleRatio >= 0.75) score += 36;

      if (exactGeral) score += 28;
      else if (hasAllTokens(tokensGeral, catTokens)) score += 18;
      else if (catTokens.length > 1 && geralRatio >= 0.75) score += 10;

      score += Math.min(catTokens.length, 6) * 4;

      if (catTokens.length === 1 && !exactTitle && !tokensTitulo.includes(catTokens[0])) score = 0;
      if (score < 34) return null;
      return { cat, score, tokens: catTokens };
    }).filter(Boolean);

    return scored
      .filter(item => !scored.some(other =>
        other !== item &&
        other.score >= item.score - 35 &&
        other.tokens.length > item.tokens.length &&
        item.tokens.every(t => other.tokens.includes(t))
      ))
      .sort((a, b) => b.score - a.score || b.tokens.length - a.tokens.length)
      .map(item => item.cat);
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

