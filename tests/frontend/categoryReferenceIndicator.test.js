// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderCategoryReferenceIndicator } from '../../src/components/CategoryReferenceIndicator.js';

describe('indicador de referência da categoria', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="learn-indicator empty" id="indicator"><span id="learnIndicatorText"></span></div>';
  });

  function render(options) {
    const element = document.getElementById('indicator');
    renderCategoryReferenceIndicator(element, options);
    return element;
  }

  it('diferencia rascunho de referência publicada', () => {
    const indicator = render({ catalog: [] });

    expect(indicator.textContent).toBe('Nenhuma referência publicada');
    expect(indicator.title).toContain('Rascunhos não entram na ficha');
    expect(indicator.dataset.state).toBe('empty');
  });

  it('mostra qual referência publicada será aplicada', () => {
    const category = { id: 'carrinho', nome: 'Carrinho' };
    const indicator = render({
      catalog: [category],
      resolution: {
        categories: [category],
        categoryMatch: { evidence: ['Carrinho'] },
      },
    });

    expect(indicator.textContent).toBe('Referência aplicada: Carrinho');
    expect(indicator.title).toContain('Carrinho');
    expect(indicator.classList.contains('empty')).toBe(false);
    expect(indicator.dataset.state).toBe('matched');
  });

  it('avisa quando o produto não corresponde ao catálogo ativo', () => {
    const indicator = render({
      catalog: [{ id: 'garrafa', nome: 'Garrafa' }],
      resolution: { categories: [] },
    });

    expect(indicator.textContent).toBe('Nenhuma referência corresponde ao produto');
    expect(indicator.dataset.state).toBe('unmatched');
  });
});
