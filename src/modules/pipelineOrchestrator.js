import { buildQaInput, insertNoticeBeforeSupplier } from './pipelineDomain.js';

/**
 * @typedef {1|2|3} PipelineStage
 * @typedef {'pipeline'|'regeneration'} PipelineRunMode
 *
 * Eventos neutros emitidos pelo núcleo. O controlador de interface decide como
 * representá-los e onde persistir métricas ou resultados.
 * @typedef {
 *   | { type: 'stage-start'; stage: PipelineStage; mode: PipelineRunMode; bivolt?: boolean }
 *   | { type: 'agent-call-complete'; stage: PipelineStage; mode: PipelineRunMode }
 *   | { type: 'stage-complete'; stage: PipelineStage; mode: PipelineRunMode; qa?: object }
 *   | { type: 'stage-skipped'; stage: 3; mode: 'pipeline'; reason: 'rejected'|'manual' }
 *   | { type: 'usage'; stage: PipelineStage; mode: PipelineRunMode; usage: object }
 *   | { type: 'provider-event'; stage: PipelineStage; mode: PipelineRunMode; event: object }
 * } PipelineOrchestratorEvent
 */

const noop = () => {};

function tracking(stage, mode, emit) {
  return {
    onUsage: usage => emit({ type: 'usage', stage, mode, usage }),
    onEvent: event => emit({ type: 'provider-event', stage, mode, event }),
  };
}

function assertDependencies(dependencies) {
  const required = [
    'callAgent',
    'stabilizeFichaOutput',
    'validateFichaOutput',
    'parseQAJson',
    'mergeQAFindings',
    'formatQAReport',
  ];
  const missing = required.filter(name => typeof dependencies[name] !== 'function');
  if (missing.length) throw new TypeError(`Dependências inválidas do pipeline: ${missing.join(', ')}`);
}

/** Executa somente o A3 e é reutilizado tanto no fluxo completo quanto no rerun. */
export async function runCopywriterAgent(options, dependencies) {
  const emit = dependencies.emit || noop;
  const mode = options.mode || 'regeneration';

  emit({ type: 'stage-start', stage: 3, mode });
  const conteudo = await dependencies.callAgent(
    options.systemPrompt,
    options.ficha,
    800,
    options.signal,
    3,
    tracking(3, mode, emit),
  );
  emit({ type: 'agent-call-complete', stage: 3, mode });
  emit({ type: 'stage-complete', stage: 3, mode });
  return conteudo;
}

/**
 * Executa a sequência de domínio A1 -> A2 -> A3 sem conhecer a interface.
 * O cancelamento é propagado ao runtime pela mesma instância de AbortSignal.
 */
export async function runPipelineAgents(options, dependencies) {
  assertDependencies(dependencies);
  const emit = dependencies.emit || noop;
  const mode = 'pipeline';

  emit({ type: 'stage-start', stage: 1, mode, bivolt: options.bivolt });
  let ficha = await dependencies.callAgent(
    options.prompts.agent1,
    `DADOS DO PRODUTO:\n${options.input}`,
    7000,
    options.signal,
    1,
    tracking(1, mode, emit),
  );
  emit({ type: 'agent-call-complete', stage: 1, mode });

  ficha = dependencies.stabilizeFichaOutput(options.input, ficha);
  if (options.notice) ficha = insertNoticeBeforeSupplier(ficha, options.notice);
  const localFindings = dependencies.validateFichaOutput(options.input, ficha);
  emit({ type: 'stage-complete', stage: 1, mode });

  emit({ type: 'stage-start', stage: 2, mode });
  const validacaoRaw = await dependencies.callAgent(
    options.prompts.agent2,
    buildQaInput({
      input: options.input,
      ficha,
      noticeValidation: options.noticeValidation,
      qaSchemaPrompt: options.qaSchemaPrompt,
    }),
    1500,
    options.signal,
    2,
    tracking(2, mode, emit),
  );
  emit({ type: 'agent-call-complete', stage: 2, mode });

  const qa = dependencies.mergeQAFindings(
    dependencies.parseQAJson(validacaoRaw),
    localFindings,
  );
  const validacao = dependencies.formatQAReport(qa);
  const reprovado = qa.status === 'REPROVADO';
  emit({ type: 'stage-complete', stage: 2, mode, qa });

  let conteudo = '';
  if (!reprovado && options.autoRunCopywriter) {
    conteudo = await runCopywriterAgent({
      systemPrompt: options.prompts.agent3,
      ficha,
      signal: options.signal,
      mode,
    }, { ...dependencies, emit });
  } else {
    emit({
      type: 'stage-skipped',
      stage: 3,
      mode,
      reason: reprovado ? 'rejected' : 'manual',
    });
  }

  return { ficha, validacao, validacaoRaw, qa, conteudo, reprovado };
}
