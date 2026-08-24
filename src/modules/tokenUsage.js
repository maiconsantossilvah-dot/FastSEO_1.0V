/**
 * Normaliza e acumula o consumo oficial devolvido pelas APIs de IA.
 * Nenhum valor deste módulo é estimado por caracteres.
 */

function asTokenCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeCall(value = {}) {
  const inputTokens = asTokenCount(value.inputTokens);
  const outputTokens = asTokenCount(value.outputTokens);
  const thinkingTokens = asTokenCount(value.thinkingTokens);
  const totalTokens = asTokenCount(value.totalTokens)
    || inputTokens + outputTokens + thinkingTokens;

  return {
    stage: Math.min(3, Math.max(1, asTokenCount(value.stage) || 1)),
    provider: String(value.provider || '').toLowerCase(),
    model: String(value.model || ''),
    kind: value.kind === 'regeneration' ? 'regeneration' : 'generation',
    inputTokens,
    outputTokens,
    thinkingTokens,
    cachedTokens: asTokenCount(value.cachedTokens),
    totalTokens,
  };
}

function recalculate(summary) {
  const totals = summary.calls.reduce((acc, call) => {
    acc.inputTokens += call.inputTokens;
    acc.outputTokens += call.outputTokens;
    acc.thinkingTokens += call.thinkingTokens;
    acc.cachedTokens += call.cachedTokens;
    acc.totalTokens += call.totalTokens;
    return acc;
  }, {
    inputTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
  });

  Object.assign(summary, totals, { requestCount: summary.calls.length });
  return summary;
}

export function createTokenUsage(source = {}) {
  const calls = Array.isArray(source?.calls)
    ? source.calls.map(normalizeCall).filter(call => call.totalTokens > 0)
    : [];

  return recalculate({ calls });
}

export function addTokenCall(summary, stage, usage, kind = 'generation') {
  const target = summary?.calls ? summary : createTokenUsage();
  const call = normalizeCall({ ...usage, stage, kind });
  if (call.totalTokens > 0) target.calls.push(call);
  return recalculate(target);
}

export function getStageTokenUsage(summary, stage) {
  return createTokenUsage({
    calls: (summary?.calls || []).filter(call => Number(call.stage) === Number(stage)),
  });
}

export function formatTokenCount(value) {
  return asTokenCount(value).toLocaleString('pt-BR');
}
