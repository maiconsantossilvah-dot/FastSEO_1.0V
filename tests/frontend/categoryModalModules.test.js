// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryModalState } from '../../src/components/categories/CategoryModalState.js';
import {
  applyAiSuggestion,
  buildAiAnalysisPayload,
  countReadyExamples,
  normalizeAiSuggestion,
  readEditorDraft,
} from '../../src/components/categories/CategoryEditor.js';
import {
  aiSuggestionHtml,
  categoryEditorHtml,
  categoryListHtml,
  escapeHtml,
  modifiersHtml,
} from '../../src/components/categories/CategoryModalView.js';

describe('CategoryModalState', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mantém somente o autosave mais recente e limpa o timer após executar', () => {
    const state = new CategoryModalState(globalThis);
    const first = vi.fn();
    const second = vi.fn();

    state.scheduleSave(first);
    state.scheduleSave(second);
    vi.advanceTimersByTime(700);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(state.saveTimer).toBeNull();
  });

  it('troca o editor descartando sugestão temporária', () => {
    const state = new CategoryModalState(globalThis);
    state.aiSuggestion = { profileType: 'compact' };
    state.openEditor('celular');

    expect(state.editingId).toBe('celular');
    expect(state.aiSuggestion).toBeNull();
  });
});

describe('CategoryEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="catEditNome" value="Celular" />
      <select id="catEditProfileType"><option value="compact">Compacto</option><option value="technical" selected>Técnico</option></select>
      <select id="catEditParent"><option value="eletronicos" selected>Eletrônicos</option></select>
      <textarea id="catEditAliases">smartphone\naparelho celular</textarea>
      <textarea id="catEditNegativeTerms">capa para celular</textarea>
      <textarea id="catEditObrigatorios">Marca\nModelo</textarea>
      <textarea id="catEditOpcionais">Cor\nMemória</textarea>
      <textarea id="catEditFichaIdeal">FICHA IDEAL</textarea>
      <select id="catEditAvisoFicha"><option value="normal" selected>Normal</option></select>
      <textarea id="catEditTitleFormula">Marca + Modelo</textarea>
      <textarea id="catEditTitleExample">ACME X1</textarea>
      <div id="catEditModifiers"><div class="cat-modifier-row" data-id="5g">
        <input data-mod-name value="5G"/><input data-mod-aliases value="quinta geração"/><input data-mod-fields value="Bandas, Velocidade"/>
      </div></div>`;
  });

  it('converte o formulário em um draft de domínio', () => {
    expect(readEditorDraft(document)).toEqual(expect.objectContaining({
      nome: 'Celular',
      profileType: 'technical',
      parentId: 'eletronicos',
      aliases: ['smartphone', 'aparelho celular'],
      camposObrigatorios: ['Marca', 'Modelo'],
      modifiers: [expect.objectContaining({
        id: '5g', nome: '5G', aliases: ['quinta geração'], camposOpcionais: ['Bandas', 'Velocidade'],
      })],
    }));
  });

  it('valida, limita e normaliza a sugestão externa da IA', () => {
    const suggestion = normalizeAiSuggestion({
      profileType: 'technical',
      summary: 'x'.repeat(700),
      aliases: Array.from({ length: 20 }, (_, index) => `alias ${index}`),
      requiredFields: ['Marca'],
      modifiers: [{ name: '5G', aliases: ['quinta geração'] }, { name: '' }],
    });

    expect(suggestion.summary).toHaveLength(600);
    expect(suggestion.aliases).toHaveLength(12);
    expect(suggestion.modifiers).toHaveLength(1);
    expect(() => normalizeAiSuggestion({ profileType: 'impossível' })).toThrow('tipo de perfil inválido');
  });

  it('aplica a sugestão no formulário e devolve modificadores compatíveis', () => {
    const modifiers = applyAiSuggestion(document, {
      profileType: 'compact', aliases: ['telefone', 'telefone'], negativeTerms: [],
      requiredFields: ['Marca'], optionalFields: ['Cor'], idealSheet: 'NOVA FICHA',
      titleRule: { formula: 'Produto + Marca', example: 'Celular ACME' },
      modifiers: [{ id: 'dual-sim', name: 'Dual SIM', addOptionalFields: ['Quantidade de chips'] }],
    });

    expect(document.getElementById('catEditAliases').value).toBe('telefone');
    expect(document.getElementById('catEditProfileType').value).toBe('compact');
    expect(modifiers).toEqual([expect.objectContaining({
      id: 'dual-sim', nome: 'Dual SIM', camposOpcionais: ['Quantidade de chips'],
    })]);
  });

  it('conta fichas prontas e limita o payload enviado para análise', () => {
    const examples = ['a'.repeat(40), 'b'.repeat(39), 'c'.repeat(4000)];
    const draft = readEditorDraft(document);
    const payload = buildAiAnalysisPayload(draft, examples);

    expect(countReadyExamples(examples)).toBe(2);
    expect(payload.exampleSheets[2].content).toHaveLength(3500);
    expect(payload.category).toBe('Celular');
  });
});

describe('CategoryModalView', () => {
  it('escapa conteúdo externo e respeita ações por permissão', () => {
    const category = { id: 'x" onclick="alert(1)', nome: '<script>erro</script>', status: 'published' };
    const readOnly = categoryListHtml([category], {
      query: '', activeId: null, canManage: false, hasDefinition: () => true,
    });
    const editable = categoryListHtml([category], {
      query: '', activeId: null, canManage: true, hasDefinition: () => true,
    });

    expect(readOnly).not.toContain('<script>');
    expect(readOnly).toContain('&lt;script&gt;erro&lt;/script&gt;');
    expect(readOnly).not.toContain('cats-btn-del');
    expect(editable).toContain('cats-btn-del');
    expect(escapeHtml('"<&')).toBe('&quot;&lt;&amp;');
  });

  it('renderiza editor, modificadores e sugestão sem acoplar listeners', () => {
    const editor = categoryEditorHtml({
      id: 'celular', nome: 'Celular', status: 'draft', profileType: 'technical',
      aliases: [], negativeTerms: [], camposObrigatorios: [], camposOpcionais: [],
      fichaIdeal: '', titleRule: {}, modifiers: [], avisoFichaTipo: 'normal', parentId: null,
    }, {
      canManage: true,
      parents: [{ id: 'eletronicos', nome: 'Eletrônicos' }],
      noticeOptions: [{ key: 'normal', label: 'Normal' }],
    });

    expect(editor).toContain('id="catEditNome"');
    expect(editor).toContain('id="catAnalyzeAiBtn"');
    expect(modifiersHtml([], true)).toContain('Nenhum modificador');
    expect(aiSuggestionHtml({
      profileType: 'compact', summary: '<b>resumo</b>', aliases: [], requiredFields: [], optionalFields: [], modifiers: [],
    })).toContain('&lt;b&gt;resumo&lt;/b&gt;');
  });
});
