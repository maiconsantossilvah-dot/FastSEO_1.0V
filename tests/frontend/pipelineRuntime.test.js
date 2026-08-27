// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callAgent: vi.fn(),
  pipelineUI: {
    setStep: vi.fn(), log: vi.fn(), updateTokenUsage: vi.fn(), showResults: vi.fn(),
    setStepApi: vi.fn(), clearResults: vi.fn(), resetSteps: vi.fn(), setRunning: vi.fn(),
    toast: vi.fn(),
  },
  appState: {
    pipeline: { result: {}, abort: null },
    categories: { active: null, editorOpen: false, saveTimer: null },
    pdfTexto: '',
  },
  usageRecord: vi.fn(),
}));

vi.mock('../../src/services/api.js', () => ({ callAgent: mocks.callAgent }));
vi.mock('../../src/components/PipelineUI.js', () => ({ PipelineUI: mocks.pipelineUI }));
vi.mock('../../src/modules/state.js', () => ({ AppState: mocks.appState }));
vi.mock('../../src/modules/prompts.js', () => ({ Prompts: { get: () => 'prompt' } }));
vi.mock('../../src/modules/categories.js', () => ({
  Categories: {
    resolveDetailed: vi.fn(async () => ({ categories: [], titleRule: null })),
    getAll: () => [], find: () => null, update: vi.fn(),
  },
}));
vi.mock('../../src/modules/quota.js', () => ({
  Quota: { getUsage: () => ({ count: 0 }), getLimit: () => 10, add: vi.fn(), updateUI: vi.fn() },
  Logs: { save: vi.fn(async () => {}) },
}));
vi.mock('../../src/modules/history.js', () => ({
  History: { save: vi.fn(async () => 'history'), updateResult: vi.fn(async () => {}) },
}));
vi.mock('../../src/utils/index.js', () => ({
  Utils: { buildFewShot: () => '', validateInput: () => [], detectBivolt: () => false, escHtml: value => value },
}));
vi.mock('../../src/modules/qa.js?v=20260824-compact', () => ({
  parseQAJson: vi.fn(() => ({ status: 'APROVADO', confianca: 1 })),
  formatQAReport: vi.fn(() => 'QA APROVADO'),
  mergeQAFindings: vi.fn(() => ({ status: 'APROVADO', confianca: 1 })),
}));
vi.mock('../../src/modules/categoryNotices.js', () => ({ getCategoryNotice: () => ({ text: '' }) }));
vi.mock('../../src/modules/categoryQaSchema.js', () => ({
  buildCategoryQaSchemaPrompt: () => '', hasCategoryDefinition: () => false, textToFieldList: () => [],
}));
vi.mock('../../src/utils/apiKeys.js', () => ({ isValidGeminiKey: () => true }));
vi.mock('../../src/modules/outputGuards.js', () => ({
  stabilizeFichaOutput: (_input, output) => output, validateFichaOutput: () => [],
}));
vi.mock('../../src/services/usageAnalytics.js', () => ({
  UsageAnalytics: { record: mocks.usageRecord },
}));
vi.mock('../../src/utils/prepareProductInput.js', () => ({
  prepareProductInput: value => ({ text: value, warnings: [] }),
}));
vi.mock('../../src/services/apiSettings.js', () => ({
  ApiSettings: {
    getGeminiPrimary: () => 'valid-gemini-key', getMistralPrimary: () => '', getModel: () => 'gemini-test',
  },
}));
vi.mock('../../src/services/serp.js', () => ({
  buscarKeywords: vi.fn(), montarContextoSEO: vi.fn(), hasSerpApiKey: () => false,
}));
vi.mock('../../src/services/analytics.js', () => ({
  trackPipelineIniciado: vi.fn(), trackPipelineConcluido: vi.fn(), trackPipelineErro: vi.fn(),
  trackCotaAtingida: vi.fn(), trackRegeneracao: vi.fn(),
}));

const { Pipeline } = await import('../../src/modules/pipeline.js');

describe('Pipeline com runtime mockado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.appState.pipeline.result = { ficha: 'FICHA TÉCNICA', bivolt: false };
    document.body.innerHTML = `
      <textarea id="inputText">Produto</textarea>
      <pre id="fichaOut">FICHA TÉCNICA</pre>
      <pre id="conteudoOut"></pre>
      <section id="copyBlock" style="display:none"></section>
    `;
    const usage = {
      provider: 'gemini', model: 'gemini-test', inputTokens: 10, outputTokens: 2,
      thinkingTokens: 0, cachedTokens: 0, totalTokens: 12,
    };
    mocks.callAgent.mockImplementation(async (_system, _user, _max, _signal, _agent, tracking) => {
      tracking.onEvent({ type: 'usage', usage });
      tracking.onUsage(usage);
      return 'CONTEÚDO COMERCIAL';
    });
    globalThis.fetch = vi.fn(() => { throw new Error('fetch real não deveria ser chamado'); });
  });

  it('orquestra A3 sem rede real e traduz eventos do runtime na UI', async () => {
    await Pipeline.rerunCopywriter();

    expect(mocks.callAgent).toHaveBeenCalledOnce();
    expect(mocks.callAgent.mock.calls[0][4]).toBe(3);
    expect(mocks.callAgent.mock.calls[0][3]).toBeInstanceOf(AbortSignal);
    expect(mocks.pipelineUI.setStepApi).toHaveBeenCalledWith(3, 'Gemini');
    expect(mocks.pipelineUI.updateTokenUsage).toHaveBeenCalled();
    expect(document.getElementById('conteudoOut').innerText).toBe('CONTEÚDO COMERCIAL');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('executa A1, A2 e A3 em ordem usando somente o contrato mockado', async () => {
    mocks.callAgent.mockImplementation(async (_system, _user, _max, _signal, agent, tracking) => {
      const usage = {
        provider: agent === 1 ? 'mistral' : 'gemini', model: 'test', inputTokens: 5,
        outputTokens: 2, thinkingTokens: 0, cachedTokens: 0, totalTokens: 7,
      };
      tracking.onEvent({ type: 'usage', usage });
      tracking.onUsage(usage);
      if (agent === 1) return 'FICHA GERADA';
      if (agent === 2) return '{"status":"APROVADO"}';
      return 'CONTEÚDO GERADO';
    });

    await Pipeline._execute('Produto completo');

    expect(mocks.callAgent.mock.calls.map(call => call[4])).toEqual([1, 2, 3]);
    expect(mocks.pipelineUI.setStepApi).toHaveBeenNthCalledWith(1, 1, 'Mistral');
    expect(mocks.pipelineUI.setStepApi).toHaveBeenNthCalledWith(2, 2, 'Gemini');
    expect(mocks.pipelineUI.setStepApi).toHaveBeenNthCalledWith(3, 3, 'Gemini');
    expect(mocks.pipelineUI.showResults).toHaveBeenCalledWith(
      'FICHA GERADA', 'QA APROVADO', 'CONTEÚDO GERADO', false, false, expect.any(Object),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
