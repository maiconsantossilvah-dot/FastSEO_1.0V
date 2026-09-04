// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({
  providers: { 1: 'mistral', 2: 'gemini', 3: 'gemini' },
  models: {},
  setAgentProvider: vi.fn((stage, provider) => { settings.providers[stage] = provider; }),
  setAgentModel: vi.fn((stage, provider, model) => { settings.models[`${stage}:${provider}`] = model; }),
}));

vi.mock('../../src/services/apiSettings.js', () => ({
  ApiSettings: {
    getGeminiPrimary: () => '', setGeminiPrimary: vi.fn(),
    getMistralPrimary: () => '', setMistralPrimary: vi.fn(),
    getGroqPrimary: () => '', setGroqPrimary: vi.fn(),
    getModel: () => 'gemini-3.5-flash-lite', setModel: vi.fn(),
    getFallback: () => '', setFallback: vi.fn(),
    getProviderKeys: () => [],
    getAgentProvider: stage => settings.providers[stage],
    setAgentProvider: settings.setAgentProvider,
    getAgentModel: (stage, provider) => settings.models[`${stage}:${provider}`]
      || ({ gemini: 'gemini-3.5-flash-lite', mistral: 'mistral-medium-latest', groq: 'openai/gpt-oss-120b' })[provider],
    setAgentModel: settings.setAgentModel,
  },
}));
vi.mock('../../src/modules/quota.js', () => ({ Quota: { updateUI: vi.fn() } }));
vi.mock('../../src/services/serp.js', () => ({
  getGoogleApiKey: () => '', setGoogleApiKey: vi.fn(), getGoogleCx: () => '', setGoogleCx: vi.fn(),
}));
vi.mock('../../src/services/analytics.js', () => ({ trackSerpApiConfigurada: vi.fn() }));

const { ConfigModal } = await import('../../src/components/ConfigUI.js');

describe('roteamento no modal de APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings.providers = { 1: 'mistral', 2: 'gemini', 3: 'gemini' };
    settings.models = {};
    document.body.innerHTML = `
      <div id="hiddenApiInputs">
        <input type="password" id="apiKey">
        <input type="password" id="mistralKey">
        <input type="password" id="groqKey">
        <select id="modelSel"><option value="gemini-3.5-flash-lite">Gemini</option></select>
      </div>`;
  });

  it('renderiza configuração independente para A1, A2 e A3', () => {
    ConfigModal.open();

    expect(document.querySelectorAll('[data-agent-route]')).toHaveLength(3);
    expect(document.getElementById('agent1Provider').value).toBe('mistral');
    expect(document.getElementById('agent2Provider').value).toBe('gemini');
    expect(document.getElementById('agent3Provider').value).toBe('gemini');
    expect(document.getElementById('groqKey').parentElement.id).toBe('groqKeySlot');
  });

  it('exibe somente os modelos gratuitos de produção ao selecionar Groq', () => {
    ConfigModal.open();
    const provider = document.getElementById('agent1Provider');
    provider.value = 'groq';
    provider.dispatchEvent(new Event('change'));

    const models = [...document.getElementById('agent1Model').options].map(option => option.value);
    expect(models).toEqual(['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);
    expect(settings.setAgentProvider).toHaveBeenCalledWith(1, 'groq');
    expect(document.getElementById('agent1Hint').textContent).toContain('Adicione uma chave Groq');
  });

  it('devolve todas as credenciais ao container protegido ao fechar', () => {
    ConfigModal.open();
    ConfigModal.close();

    const hidden = document.getElementById('hiddenApiInputs');
    expect(hidden.querySelector('#groqKey')).not.toBeNull();
    expect(hidden.querySelector('#groqKey2')).not.toBeNull();
    expect(document.getElementById('configModalOverlay')).toBeNull();
  });
});
