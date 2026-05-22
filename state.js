/**
 * modules/state.js
 * -----------------
 * Estado global centralizado da aplicacao.
 * Todos os modulos importam daqui - nunca criam estado proprio.
 */

export const AppState = {
  sidebar:  { open: true },
  pipeline: { running: false, result: {}, abort: null },
  categories: {
    active:     null,   // ID da categoria selecionada
    editorOpen: false,
    saveTimer:  null,
  },
  prompts: {
    activeTab: 'P1',
    saveTimer: null,
  },

  /**
   * subcatRules - referencia as regras de subcategoria em uso.
   * Populado pelo SubcatModule na inicializacao.
   * Exposto aqui para que o Pipeline acesse sem acoplamento circular.
   */
  subcatRules: {
    _rules:     [],
    _normalize(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    },
    setRules(rules) { this._rules = rules; },
    match(input) {
      const normalize = s => String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[-/]/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const stopWords = new Set(['o','a','os','as','um','uma','uns','umas','de','do','da','dos','das','para','com','por','em','no','na','nos','nas','e']);
      const tokenize = s => normalize(s).split(' ').filter(t => t && !stopWords.has(t));
      const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hasPhrase = (text, phrase) => new RegExp(`(?:^|\\s)${escapeRe(phrase)}(?:\\s|$)`).test(text);
      const isLinhaRuido = line => {
        const semEspaco = line.replace(/\s/g, '');
        if (!semEspaco.length) return true;
        if ((semEspaco.match(/\d/g) || []).length / semEspaco.length > 0.5) return true;
        if (/\b(ean|ncm|gtin|sku)\b/i.test(line)) return true;
        if (/^\s*(fornecedor|marca|ref|cod|codigo|cod\.|fabricante|modelo|origem)\s*:/i.test(normalize(line))) return true;
        return false;
      };

      const linhas = String(input || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 10);
      const linhasUteis = linhas.filter(l => !isLinhaRuido(l) && l.replace(/\d/g, '').trim().length >= 4);
      const titulo = normalize(linhasUteis.slice(0, 3).join(' ') || linhas[0] || '');
      const geral = normalize(input).slice(0, 1200);
      const tokensTitulo = tokenize(titulo);
      const tokensGeral = tokenize(geral);

      let best = null, bestScore = 0, bestLen = 0;
      for (const rule of this._rules) {
        const key = normalize(rule.nome);
        const ruleTokens = tokenize(rule.nome);
        if (!key || !ruleTokens.length) continue;

        const titleHits = ruleTokens.filter(t => tokensTitulo.includes(t)).length;
        const geralHits = ruleTokens.filter(t => tokensGeral.includes(t)).length;
        let score = 0;
        if (hasPhrase(titulo, key)) score += 80;
        else if (titleHits === ruleTokens.length) score += 58;
        else if (ruleTokens.length > 1 && titleHits / ruleTokens.length >= 0.75) score += 36;

        if (hasPhrase(geral, key)) score += 22;
        else if (geralHits === ruleTokens.length) score += 14;

        score += Math.min(ruleTokens.length, 6) * 4;
        if (ruleTokens.length === 1 && !tokensTitulo.includes(ruleTokens[0])) score = 0;

        if (score >= 34 && (score > bestScore + 35 || (score >= bestScore - 35 && key.length > bestLen))) {
          best = rule;
          bestScore = score;
          bestLen = key.length;
        }
      }
      return best;
    },
    buildSnippet(rule) {
      if (!rule) return '';
      let s = `\n\n-- PADRAO DE TITULO PARA "${rule.nome}" --\n`;
      s += `Estrutura do titulo: ${rule.formula}\n`;
      if (rule.ex) s += `Exemplo: ${rule.ex}\n`;
      s += 'Siga exatamente essa estrutura ao gerar o TITULO SEO desta ficha.';
      return s;
    },
  },
};

