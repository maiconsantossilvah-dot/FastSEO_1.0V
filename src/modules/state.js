/**
 * modules/state.js
 * -----------------
 * Estado global centralizado da aplicacao.
 * Todos os modulos importam daqui - nunca criam estado proprio.
 */

import { bestMatch } from '../utils/matching.js';

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
      return bestMatch(input, this._rules, item => item.nome, { scope: 'title' });
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

