import { describe, expect, it, vi } from 'vitest';
import {
  buildPipelinePrompts,
  buildQaInput,
  insertNoticeBeforeSupplier,
  resolveTitleRule,
} from '../../src/modules/pipelineDomain.js';
import { runCopywriterAgent, runPipelineAgents } from '../../src/modules/pipelineOrchestrator.js';

function createDependencies({ qaStatus = 'APROVADO', callAgent } = {}) {
  const emit = vi.fn();
  const defaultCallAgent = vi.fn(async (_system, _user, _max, _signal, agent) => {
    if (agent === 1) return 'FICHA GERADA\n\nFornecedor: ACME';
    if (agent === 2) return JSON.stringify({ status: qaStatus });
    return 'CONTEÚDO GERADO';
  });

  return {
    callAgent: callAgent || defaultCallAgent,
    stabilizeFichaOutput: vi.fn((_input, ficha) => ficha),
    validateFichaOutput: vi.fn(() => ({ errors: [], warnings: [] })),
    parseQAJson: vi.fn(() => ({ status: qaStatus, confianca: 'ALTA' })),
    mergeQAFindings: vi.fn(qa => qa),
    formatQAReport: vi.fn(qa => `STATUS: ${qa.status}`),
    emit,
  };
}

function baseOptions(overrides = {}) {
  return {
    input: 'Produto completo\nFornecedor: ACME',
    bivolt: false,
    prompts: { agent1: 'P1', agent2: 'P2', agent3: 'P3' },
    notice: '',
    noticeValidation: '',
    qaSchemaPrompt: '',
    autoRunCopywriter: true,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('pipelineDomain', () => {
  it('preserva SEO fora do A2 e aplica a regra de título ao A1/A3', () => {
    const prompts = buildPipelinePrompts({
      getPrompt: key => key,
      bivolt: false,
      fewShot: '\nEXEMPLO',
      titleRule: { nome: 'Celular', formula: '[Marca] [Modelo]' },
      seoContext: 'SEO CONTEXT',
    });

    expect(prompts.agent1).toContain('P1\nEXEMPLO');
    expect(prompts.agent1).toContain('Estrutura do título: [Marca] [Modelo]');
    expect(prompts.agent1).toContain('SEO CONTEXT');
    expect(prompts.agent2).toBe('P2');
    expect(prompts.agent3).toContain('SEO CONTEXT');
  });

  it('mantém o aviso imediatamente antes do fornecedor sem duplicá-lo', () => {
    const once = insertNoticeBeforeSupplier('TÍTULO\n\nFornecedor: ACME', 'AVISO INTERNO');
    const twice = insertNoticeBeforeSupplier(once, 'AVISO INTERNO');

    expect(once).toBe('TÍTULO\n\nAVISO INTERNO\n\nFornecedor: ACME');
    expect(twice).toBe(once);
  });

  it('prioriza a regra compilada da categoria e monta o contrato do A2', () => {
    const titleRule = resolveTitleRule([
      { nome: 'Celular', titleRule: { formula: '[Marca]', example: 'ACME' } },
    ], { titleRule: { nome: 'Fallback', formula: '[Produto]' } });
    const input = buildQaInput({
      input: 'BRUTO', ficha: 'FICHA', noticeValidation: '\nAVISO', qaSchemaPrompt: '{"tipo":"celular"}',
    });

    expect(titleRule).toEqual({ nome: 'Celular', formula: '[Marca]', ex: 'ACME' });
    expect(input).toContain('DADOS BRUTOS ORIGINAIS:\nBRUTO');
    expect(input).toContain('FICHA GERADA:\nFICHA\nAVISO');
    expect(input).toContain('JSON DE VALIDAÇÃO DA CATEGORIA:\n{"tipo":"celular"}');
  });
});

describe('pipelineOrchestrator', () => {
  it('executa A1, A2 e A3 em ordem e retorna um resultado aprovado', async () => {
    const dependencies = createDependencies();
    const result = await runPipelineAgents(baseOptions(), dependencies);

    expect(dependencies.callAgent.mock.calls.map(call => call[4])).toEqual([1, 2, 3]);
    expect(dependencies.callAgent.mock.calls.map(call => call[2])).toEqual([7000, 1500, 800]);
    expect(result).toMatchObject({
      ficha: 'FICHA GERADA\n\nFornecedor: ACME',
      validacao: 'STATUS: APROVADO',
      conteudo: 'CONTEÚDO GERADO',
      reprovado: false,
    });
    expect(dependencies.emit.mock.calls.flatMap(call => call[0])
      .filter(event => event.type === 'agent-call-complete').map(event => event.stage))
      .toEqual([1, 2, 3]);
  });

  it('não chama o A3 quando o QA reprova a ficha', async () => {
    const dependencies = createDependencies({ qaStatus: 'REPROVADO' });
    const result = await runPipelineAgents(baseOptions(), dependencies);

    expect(dependencies.callAgent.mock.calls.map(call => call[4])).toEqual([1, 2]);
    expect(result.reprovado).toBe(true);
    expect(result.conteudo).toBe('');
    expect(dependencies.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'stage-skipped', stage: 3, reason: 'rejected',
    }));
  });

  it('propaga cancelamento e não inicia os agentes seguintes', async () => {
    const aborted = Object.assign(new Error('Cancelado'), { name: 'AbortError' });
    const callAgent = vi.fn(async () => { throw aborted; });
    const dependencies = createDependencies({ callAgent });
    const options = baseOptions();

    await expect(runPipelineAgents(options, dependencies)).rejects.toBe(aborted);
    expect(callAgent).toHaveBeenCalledOnce();
    expect(callAgent.mock.calls[0][3]).toBe(options.signal);
    expect(dependencies.emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'agent-call-complete' }));
  });

  it('reutiliza o contrato do A3 na regeneração e encaminha telemetria', async () => {
    const emit = vi.fn();
    const usage = { provider: 'gemini', totalTokens: 12 };
    const callAgent = vi.fn(async (_system, _user, _max, _signal, _stage, tracking) => {
      tracking.onUsage(usage);
      return 'NOVA COPY';
    });
    const signal = new AbortController().signal;

    const result = await runCopywriterAgent({
      systemPrompt: 'P3', ficha: 'FICHA', signal, mode: 'regeneration',
    }, { callAgent, emit });

    expect(result).toBe('NOVA COPY');
    expect(callAgent).toHaveBeenCalledWith('P3', 'FICHA', 800, signal, 3, expect.any(Object));
    expect(emit).toHaveBeenCalledWith({
      type: 'usage', stage: 3, mode: 'regeneration', usage,
    });
  });
});
