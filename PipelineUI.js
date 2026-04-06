/**
 * components/PipelineUI.js
 * Controls all pipeline UI: log, steps, results, run button.
 */

const $ = id => document.getElementById(id);

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
  setStep(n, state) { const el = $(`ps${n}`); if (el) el.className = `step ${state}`; },
  resetSteps() { [1, 2, 3].forEach(n => this.setStep(n, '')); },
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
