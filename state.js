/**
 * modules/state.js
 * ─────────────────
 * Estado global centralizado da aplicação.
 * Todos os módulos importam daqui — nunca criam estado próprio.
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
   * subcatRules — referência às regras de subcategoria em uso.
   * Populado pelo SubcatModule na inicialização.
   * Exposto aqui para que o Pipeline acesse sem acoplamento circular.
   */
  subcatRules: {
    _rules:     [],
    _normalize(s) {
      return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    },
    setRules(rules) { this._rules = rules; },
    match(input) {
      const norm = this._normalize(input);
      let best = null, bestLen = 0;
      for (const rule of this._rules) {
        const key = this._normalize(rule.nome);
        const re  = new RegExp(
          '(?<![\\w\\u00C0-\\u024F])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w\\u00C0-\\u024F])',
          'i'
        );
        if (re.test(norm) && key.length > bestLen) {
          best = rule; bestLen = key.length;
        }
      }
      return best;
    },
    buildSnippet(rule) {
      if (!rule) return '';
      let s = `\n\n── PADRÃO DE TÍTULO PARA "${rule.nome}" ──\n`;
      s += `Estrutura do título: ${rule.formula}\n`;
      if (rule.ex) s += `Exemplo: ${rule.ex}\n`;
      s += 'Siga exatamente essa estrutura ao gerar o TÍTULO SEO desta ficha.';
      return s;
    },
  },
};
