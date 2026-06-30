/**
 * modules/state.js
 * -----------------
 * Estado global centralizado da aplicação.
 * Todos os módulos importam daqui - nunca criam estado próprio.
 */

import { bestMatch } from '../utils/matching.js';

export const AppState = {
  sidebar:  { open: true },
  pipeline: { running: false, result: {}, abort: null },
  pdfTexto: '',
  inputSource: '',
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
   * subcatRules - referência às regras de subcategoria em uso.
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
      return bestMatch(input, this._rules, item => item.nome, { scope: 'title' });
    },
    buildSnippet(rule) {
      if (!rule) return '';
      let s = `\n\n-- PADRÃO DE TÍTULO PARA "${rule.nome}" --\n`;
      s += `Estrutura do título: ${rule.formula}\n`;
      if (rule.ex) s += `Exemplo: ${rule.ex}\n`;
      s += 'Siga exatamente essa estrutura ao gerar o TÍTULO SEO desta ficha.';
      return s;
    },
  },
};

