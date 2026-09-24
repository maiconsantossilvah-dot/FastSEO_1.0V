import { describe, expect, it, vi } from 'vitest';
import {
  buildPipelinePrompts,
  buildProductSource,
  buildQaInput,
  createProductSource,
  extractProductTitle,
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
    expect(prompts.agent2).toContain('P2');
    expect(prompts.agent1).toContain('POLÍTICA FIXA DE INTERPRETAÇÃO CONTROLADA');
    expect(prompts.agent2).toContain('POLÍTICA FIXA DE AUDITORIA SEMÂNTICA');
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
    expect(input).toContain('DADOS BRUTOS ORIGINAIS — FONTE FACTUAL:');
    expect(input).toContain('\nBRUTO\n\n---\nFICHA GERADA:');
    expect(input).toContain('FICHA GERADA:\nFICHA\nAVISO');
    expect(input).toContain('JSON DE VALIDAÇÃO DA CATEGORIA:\n{"tipo":"celular"}');
  });

  it('destaca o título existente como parte dos dados brutos para A1 e A2', () => {
    const raw = '1704782\nEAN: 47891150106572\nCREME DENTAL ENLACE KIDS BUBBLE GUM\nFornecedor: ACME';

    expect(extractProductTitle(raw)).toBe('CREME DENTAL ENLACE KIDS BUBBLE GUM');
    expect(buildProductSource(raw)).toContain(
      'TÍTULO ORIGINAL DO PRODUTO — FONTE FACTUAL:\nCREME DENTAL ENLACE KIDS BUBBLE GUM',
    );
    expect(buildQaInput({ input: raw, ficha: 'FICHA' })).toContain(
      'TÍTULO ORIGINAL DO PRODUTO — FONTE FACTUAL:\nCREME DENTAL ENLACE KIDS BUBBLE GUM',
    );
  });

  it('reconhece título rotulado na mesma linha ou na linha seguinte', () => {
    expect(extractProductTitle('Descrição do produto: Garrafa Térmica 1L')).toBe('Garrafa Térmica 1L');
    expect(extractProductTitle('TÍTULO DO PRODUTO:\nPrego de Aço 18x27\nEAN: 1')).toBe('Prego de Aço 18x27');
  });

  it('não promove um campo técnico a título do produto', () => {
    const source = createProductSource('CARACTERÍSTICAS DO PRODUTO\nPotência: 1200 W\nVoltagem: 220 V\nFornecedor: ACME');

    expect(source).toMatchObject({ title: '', titleSource: 'absent', titleConfidence: 'none' });
    expect(buildProductSource(source)).toContain('TÍTULO ORIGINAL DO PRODUTO — FONTE FACTUAL:\nNÃO IDENTIFICADO');
  });

  it('permite reutilizar a mesma fonte canônica no contrato do A1 e do A2', () => {
    const source = createProductSource('Título: Garrafa Térmica 1L\nMaterial: inox');
    const a1 = buildProductSource(source);
    const a2 = buildQaInput({ productSource: source, ficha: 'FICHA' });

    expect(a1).toContain('Garrafa Térmica 1L');
    expect(a2).toContain('Garrafa Térmica 1L');
    expect(a2).toContain('DADOS BRUTOS ORIGINAIS — FONTE FACTUAL:');
  });
});

describe('pipelineOrchestrator', () => {
  it('entrega a mesma fonte canônica do título ao A1 e ao A2', async () => {
    const dependencies = createDependencies();
    const raw = 'Título: Garrafa Térmica 1L\nMaterial: inox\nFornecedor: ACME';
    const productSource = createProductSource(raw);

    await runPipelineAgents(baseOptions({ input: raw, productSource }), dependencies);

    expect(dependencies.callAgent.mock.calls[0][1]).toContain(
      'TÍTULO ORIGINAL DO PRODUTO — FONTE FACTUAL:\nGarrafa Térmica 1L',
    );
    expect(dependencies.callAgent.mock.calls[1][1]).toContain(
      'TÍTULO ORIGINAL DO PRODUTO — FONTE FACTUAL:\nGarrafa Térmica 1L',
    );
  });

  it('executa A1, A2 e A3 em ordem e retorna um resultado aprovado', async () => {
    const dependencies = createDependencies();
    const result = await runPipelineAgents(baseOptions(), dependencies);

    expect(dependencies.callAgent.mock.calls.map(call => call[4])).toEqual([1, 2, 3]);
    expect(dependencies.callAgent.mock.calls.map(call => call[2])).toEqual([7000, 1500, 6000]);
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

  it('mantém a ficha aprovada disponível quando somente o A3 falha', async () => {
    const externalError = new Error('Serviço do copywriter indisponível');
    const callAgent = vi.fn(async (_system, _user, _max, _signal, agent) => {
      if (agent === 1) return 'FICHA GERADA\n\nFornecedor: ACME';
      if (agent === 2) return '{"status":"APROVADO"}';
      throw externalError;
    });
    const dependencies = createDependencies({ callAgent });

    const result = await runPipelineAgents(baseOptions(), dependencies);

    expect(result).toMatchObject({
      ficha: 'FICHA GERADA\n\nFornecedor: ACME',
      validacao: 'STATUS: APROVADO',
      conteudo: '',
      reprovado: false,
      copywriterError: externalError,
    });
    expect(dependencies.emit).toHaveBeenCalledWith({
      type: 'stage-failed', stage: 3, mode: 'pipeline', error: externalError,
    });
  });

  it('não converte cancelamento do A3 em falha opcional', async () => {
    const aborted = Object.assign(new Error('Cancelado'), { name: 'AbortError' });
    const callAgent = vi.fn(async (_system, _user, _max, _signal, agent) => {
      if (agent === 1) return 'FICHA GERADA';
      if (agent === 2) return '{"status":"APROVADO"}';
      throw aborted;
    });
    const dependencies = createDependencies({ callAgent });

    await expect(runPipelineAgents(baseOptions(), dependencies)).rejects.toBe(aborted);
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
    expect(callAgent).toHaveBeenCalledWith('P3', 'FICHA', 6000, signal, 3, expect.any(Object));
    expect(emit).toHaveBeenCalledWith({
      type: 'usage', stage: 3, mode: 'regeneration', usage,
    });
  });

  it('não considera resposta vazia do A3 como conclusão bem-sucedida', async () => {
    const emit = vi.fn();
    const callAgent = vi.fn(async () => '   ');

    await expect(runCopywriterAgent({
      systemPrompt: 'P3', ficha: 'FICHA', signal: new AbortController().signal,
    }, { callAgent, emit })).rejects.toThrow('O A3 retornou uma resposta vazia');
    expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'stage-complete' }));
  });
});
