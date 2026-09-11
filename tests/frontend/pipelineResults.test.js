// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { PipelineUI } from '../../src/components/PipelineUI.js';

describe('resultados do pipeline', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="results"></section>
      <pre id="fichaOut"></pre>
      <pre id="validacaoOut"></pre>
      <span id="statusBadge"></span>
      <span id="bivoltBadge"></span>
      <section id="copyBlock" style="display:none">
        <button id="regenConteudoBtn"><i data-lucide="refresh-cw"></i><span>Regenerar</span></button>
        <pre id="conteudoOut"></pre>
      </section>
    `;
  });

  it('exibe a ficha e a geração manual de conteúdo quando o A2 reprova', () => {
    PipelineUI.showResults('FICHA REPROVADA', 'STATUS: REPROVADO', '', false, true);

    expect(document.getElementById('results').classList.contains('vis')).toBe(true);
    expect(document.getElementById('fichaOut').textContent).toBe('FICHA REPROVADA');
    expect(document.getElementById('statusBadge').textContent).toBe('REPROVADO');
    expect(document.getElementById('copyBlock').style.display).toBe('block');
    expect(document.querySelector('#regenConteudoBtn span').textContent).toBe('Gerar conteúdo');
    expect(document.getElementById('conteudoOut').textContent).toBe('Conteúdo comercial ainda não gerado.');
  });

  it('exibe imediatamente o conteúdo retornado pelo A3 em ficha aprovada', () => {
    PipelineUI.showResults('FICHA APROVADA', 'STATUS: APROVADO', 'COPY GERADA', false, false);

    expect(document.getElementById('copyBlock').style.display).toBe('block');
    expect(document.getElementById('conteudoOut').textContent).toBe('COPY GERADA');
    expect(document.querySelector('#regenConteudoBtn span').textContent).toBe('Regenerar');
  });
});
