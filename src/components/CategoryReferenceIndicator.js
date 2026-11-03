function pluralizeReferences(count) {
  return `${count} referência${count === 1 ? '' : 's'} ativa${count === 1 ? '' : 's'}`;
}

/**
 * Mantém o resumo do rodapé coerente com o catálogo que o pipeline usa.
 * Rascunhos não entram em `catalog`; somente publicações e o legado operacional.
 */
export function renderCategoryReferenceIndicator(element, {
  catalog = [],
  resolution = null,
  degraded = false,
  failed = false,
} = {}) {
  if (!element) return;

  const label = element.querySelector('#learnIndicatorText') || element;
  const matched = resolution?.categories || [];
  let state = 'idle';
  let text = pluralizeReferences(catalog.length);
  let title = 'O pipeline usa somente referências publicadas.';

  if (degraded) {
    state = 'unavailable';
    text = 'Referências indisponíveis no modo local';
    title = 'O catálogo remoto está temporariamente indisponível.';
  } else if (failed) {
    state = 'error';
    text = 'Não foi possível verificar as referências';
    title = 'Tente novamente quando o backend estiver disponível.';
  } else if (matched.length) {
    state = 'matched';
    text = `Referência aplicada: ${matched.map(category => category.nome).join(', ')}`;
    const evidence = resolution.categoryMatch?.evidence || [];
    title = evidence.length
      ? `Correspondência no título: ${evidence.join(', ')}`
      : 'Esta referência publicada será usada na ficha.';
  } else if (resolution) {
    state = 'unmatched';
    text = catalog.length ? 'Nenhuma referência corresponde ao produto' : 'Nenhuma referência publicada';
    title = catalog.length
      ? 'A ficha será processada sem referência de categoria.'
      : 'Crie ou abra uma categoria e clique em Publicar e ativar.';
  } else if (!catalog.length) {
    state = 'empty';
    text = 'Nenhuma referência publicada';
    title = 'Rascunhos não entram na ficha. Publique a categoria para ativá-la.';
  }

  element.dataset.state = state;
  element.classList.toggle('empty', state !== 'matched');
  label.textContent = text;
  element.title = title;
}
