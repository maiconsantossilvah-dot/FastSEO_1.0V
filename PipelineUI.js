/**
 * components/PipelineUI.js
 * Controls all pipeline UI: log, steps, results, run button.
 */

const $ = id => document.getElementById(id);

// Guarda timestamps de início por step para calcular duração
const _stepStart = {};

// Mapa de qual API cada step usa (pode ser sobrescrito por setStepApi)
const _stepApiLabel = { 1: 'Mistral', 2: 'Gemini', 3: 'Gemini' };

export const PipelineUI = {
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
    box.scrollTop = box.scrollHeight;
  },

  // Atualiza label de API de um step (chamado pelo pipeline quando faz fallback)
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
      if (apiEl)  apiEl.textContent  = '';
      if (timeEl) timeEl.textContent = '';
    });
    // Reseta labels para padrão
    _stepApiLabel[1] = 'Mistral';
    _stepApiLabel[2] = 'Gemini';
    _stepApiLabel[3] = 'Gemini';
  },
  setRunning(on) {
    const btn = $('runBtn');
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('loading', on);
  },
  showResults(ficha, validacao, conteudo, bivolt, reprovado) {
    if ($('fichaOut'))     $('fichaOut').textContent     = ficha;
    if ($('validacaoOut')) $('validacaoOut').textContent = validacao;
    if ($('bivoltBadge'))  $('bivoltBadge').style.display = bivolt ? 'inline-flex' : 'none';
    const sb = $('statusBadge');
    if (sb) { sb.textContent = reprovado ? 'REPROVADO' : 'APROVADO'; sb.className = `badge ${reprovado ? 'badge-fail' : 'badge-ok'}`; }
    if (conteudo && $('conteudoOut') && $('copyBlock')) {
      $('conteudoOut').textContent = conteudo;
      $('copyBlock').style.display = 'block';
    }
    $('results')?.classList.add('vis');
  },
  clearResults() {
    const lb = $('logBox');
    if (lb) { lb.innerHTML = ''; lb.classList.remove('vis'); }
    $('results')?.classList.remove('vis');
    const cb = $('copyBlock'); if (cb) cb.style.display = 'none';
    const bb = $('bivoltBadge'); if (bb) bb.style.display = 'none';
  },
};
