/**
 * components/PipelineUI.js
 * Controla a interface do pipeline: log, etapas, resultados e botão de execução.
 */

import { createTokenUsage, formatTokenCount, getStageTokenUsage } from '../modules/tokenUsage.js';

const $ = id => document.getElementById(id);

// Guarda timestamps de início por etapa para calcular duração.
const _stepStart = {};

// Mapa de qual API cada etapa usa; pode mudar quando houver fallback.
const _stepApiLabel = { 1: 'Mistral', 2: 'Gemini', 3: 'Gemini' };

const _stageNames = { 1: 'Formatador', 2: 'Conferente', 3: 'Copywriter' };

function _providerLabel(provider) {
  return provider === 'mistral' ? 'Mistral' : provider === 'gemini' ? 'Gemini' : 'IA';
}

function _usageBreakdown(call) {
  const parts = [
    `${formatTokenCount(call.inputTokens)} entrada`,
    `${formatTokenCount(call.outputTokens)} saída`,
  ];
  if (call.thinkingTokens > 0) parts.push(`${formatTokenCount(call.thinkingTokens)} raciocínio`);
  const total = `${parts.join(' + ')} = ${formatTokenCount(call.totalTokens)}`;
  return call.cachedTokens > 0
    ? `${total} · ${formatTokenCount(call.cachedTokens)} em cache (incluídos na entrada)`
    : total;
}

export const PipelineUI = {
  toast(msg, type = 'ok') {
    const old = document.querySelector('.app-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast--${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 180);
    }, 2200);
  },

  log(msg, type = 'i') {
    const box = $('logBox');
    if (!box) return;
    box.classList.add('vis');
    const ts = new Date().toTimeString().slice(0, 8);
    const el = document.createElement('div');
    el.className = `log-line log-${type}`;
    const tsSpan  = document.createElement('span'); tsSpan.className = 'log-ts';  tsSpan.textContent = ts;
    const msgSpan = document.createElement('span'); msgSpan.className = 'log-msg'; msgSpan.textContent = msg;
    el.append(tsSpan, msgSpan);
    box.appendChild(el);
    // rAF evita recálculo de layout no meio da escrita do log.
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  },

  // Atualiza o rótulo de API exibido em uma etapa.
  setStepApi(n, apiName) {
    _stepApiLabel[n] = apiName;
    const el = $(`ps${n}Api`);
    if (el) el.textContent = apiName;
  },

  setStep(n, state) {
    const el = $(`ps${n}`);
    if (el) el.className = `step ${state}`.trim();

    const apiEl  = $(`ps${n}Api`);
    const timeEl = $(`ps${n}Time`);

    if (state === 'active') {
      _stepStart[n] = performance.now();
      if (apiEl)  apiEl.textContent  = _stepApiLabel[n] || '';
      if (timeEl) timeEl.textContent = '';
    } else if ((state === 'done' || state === 'error' || state === 'skip') && _stepStart[n]) {
      const ms  = Math.round(performance.now() - _stepStart[n]);
      const sec = (ms / 1000).toFixed(1);
      if (timeEl) timeEl.textContent = `· ${sec}s`;
      if (apiEl && state !== 'skip') apiEl.textContent = _stepApiLabel[n] || '';
      if (apiEl && state === 'skip') apiEl.textContent = '';
      delete _stepStart[n];
    }
  },

  resetSteps() {
    [1, 2, 3].forEach(n => {
      this.setStep(n, '');
      const apiEl  = $(`ps${n}Api`);
      const timeEl = $(`ps${n}Time`);
      const tokenEl = $(`ps${n}Tokens`);
      if (apiEl)  apiEl.textContent  = '';
      if (timeEl) timeEl.textContent = '';
      if (tokenEl) tokenEl.textContent = '';
    });
    // Reseta rótulos para o padrão.
    _stepApiLabel[1] = 'Mistral';
    _stepApiLabel[2] = 'Gemini';
    _stepApiLabel[3] = 'Gemini';
  },
  updateTokenUsage(source) {
    const usage = createTokenUsage(source);

    [1, 2, 3].forEach(stage => {
      const stageUsage = getStageTokenUsage(usage, stage);
      const tokenEl = $(`ps${stage}Tokens`);
      if (!tokenEl) return;
      tokenEl.textContent = stageUsage.totalTokens > 0
        ? `${formatTokenCount(stageUsage.totalTokens)} tokens`
        : '';
      tokenEl.title = stageUsage.totalTokens > 0
        ? `${_stageNames[stage]}: ${formatTokenCount(stageUsage.totalTokens)} tokens oficiais`
        : '';
    });

    const details = $('tokenUsage');
    const footer = $('tokenUsageFooter');
    if (!details || usage.totalTokens <= 0) {
      if (details) { details.hidden = true; details.open = false; }
      if (footer) footer.hidden = true;
      return;
    }

    details.hidden = false;
    if ($('tokenUsageTotal')) $('tokenUsageTotal').textContent = formatTokenCount(usage.totalTokens);
    if ($('tokenUsageGrandTotal')) $('tokenUsageGrandTotal').textContent = `${formatTokenCount(usage.totalTokens)} tokens`;

    const list = $('tokenUsageList');
    if (list) {
      list.replaceChildren(...usage.calls.map((call, index) => {
        const row = document.createElement('div');
        row.className = 'token-usage-row';

        const head = document.createElement('div');
        head.className = 'token-usage-row-head';
        const title = document.createElement('strong');
        title.textContent = `A${call.stage} · ${_stageNames[call.stage]}`;
        const provider = document.createElement('span');
        const regeneration = call.kind === 'regeneration' ? ' · Regeneração' : '';
        provider.textContent = `${_providerLabel(call.provider)}${regeneration}`;
        provider.title = call.model || provider.textContent;
        head.append(title, provider);

        const breakdown = document.createElement('div');
        breakdown.className = 'token-usage-breakdown';
        breakdown.textContent = _usageBreakdown(call);
        breakdown.title = call.model ? `Modelo: ${call.model} · Chamada ${index + 1}` : `Chamada ${index + 1}`;
        row.append(head, breakdown);
        return row;
      }));
    }

    if (footer) {
      footer.hidden = false;
      const stage3Used = usage.calls.some(call => call.stage === 3);
      const requestLabel = `${usage.requestCount} chamada${usage.requestCount === 1 ? '' : 's'} de IA`;
      const suffix = stage3Used ? '' : ' · A3 não utilizado';
      if ($('tokenUsageFooterText')) {
        $('tokenUsageFooterText').textContent = `${requestLabel} · ${formatTokenCount(usage.totalTokens)} tokens${suffix}`;
      }
    }
  },
  resetTokenUsage() {
    this.updateTokenUsage(createTokenUsage());
  },
  setRunning(on) {
    const btn = $('runBtn');
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    const label = btn.querySelector('.run-icon');
    if (label) {
      if (!label.dataset.defaultText) label.dataset.defaultText = label.textContent;
      label.textContent = on ? 'Processando ficha...' : label.dataset.defaultText;
    }
  },
  showResults(ficha, validacao, conteudo, bivolt, reprovado, tokenUsage = null) {
    if ($('fichaOut'))     $('fichaOut').textContent     = ficha;
    if ($('validacaoOut')) $('validacaoOut').textContent = validacao;
    if ($('bivoltBadge'))  $('bivoltBadge').style.display = bivolt ? 'inline-flex' : 'none';
    const sb = $('statusBadge');
    if (sb) { sb.textContent = reprovado ? 'REPROVADO' : 'APROVADO'; sb.className = `badge ${reprovado ? 'badge-fail' : 'badge-ok'}`; }
    if (!reprovado && $('conteudoOut') && $('copyBlock')) {
      $('conteudoOut').textContent = conteudo || 'Conteúdo comercial ainda não gerado.';
      $('copyBlock').style.display = 'block';
      const regenBtn = $('regenConteudoBtn');
      if (regenBtn) regenBtn.textContent = conteudo ? 'Regenerar' : 'Gerar conteúdo';
    }
    this.updateTokenUsage(tokenUsage);
    $('results')?.classList.add('vis');
  },
  clearResults() {
    const lb = $('logBox');
    if (lb) { lb.innerHTML = ''; lb.classList.remove('vis'); }
    $('results')?.classList.remove('vis');
    const cb = $('copyBlock'); if (cb) cb.style.display = 'none';
    const bb = $('bivoltBadge'); if (bb) bb.style.display = 'none';
    this.resetTokenUsage();
  },
};
