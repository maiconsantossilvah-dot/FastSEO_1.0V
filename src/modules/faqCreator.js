const faqStyle = String.raw`<link rel="stylesheet" href="https://imgprd.martinsatacado.com.br/catalogoimg/catalogo/faq.css">`;

const state = {
  items: [
    { question: '', answer: '' },
    { question: '', answer: '' },
    { question: '', answer: '' },
  ],
};

let initialized = false;

const faqTitle = 'Dúvidas Frequentes';
const $ = id => document.getElementById(id);

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatAnswer(value = '') {
  return escapeHtml(value.trim()).replace(/\r?\n/g, '<br>');
}

function renderFaqItem(item) {
  const question = escapeHtml(item.question.trim());
  const answer = formatAnswer(item.answer);

  return `
<li id="faq-section__item">
  <details id="faq-section__details" style="background-color: #ffffff; border: 1px solid #e5e5e5;">
    <summary id="faq-section__summary">
      <h3 id="faq-section__q-text" style="color: #333333;">${question}</h3>
      <span id="faq-section__icon" style="color: rgb(46, 53, 56);" aria-hidden="true"></span>
    </summary>

    <div id="faq-section__a-inner">
      <p id="faq-section__a-text" style="color: rgb(46, 53, 56);">${answer}</p>
    </div>
  </details>
</li>`;
}


// Monta o HTML final que será copiado para uso externo.
function buildFaqHtml() {
  const items = state.items
    .filter(item => item.question.trim() || item.answer.trim())
    .map(renderFaqItem)
    .join('\n\n');

  return `<meta charset="UTF-8">
${faqStyle}
<section id="faq-section" aria-labelledby="faq-section__title">
<div id="faq-section__header">
<h2 id="faq-section__title" style="color: #ffffff; background-color: rgb(0, 157, 255);">${escapeHtml(faqTitle)}</h2>
</div>
<ul id="faq-section__list" role="list">
${items}
</ul>
</section>

<!-- O CSS estrutural do FAQ é carregado pelo link acima. -->`;
}

function updateOutput() {
  const generatedHtml = $('faqGeneratedHtml');
  const previewFrame = $('faqPreviewFrame');
  const copyStatus = $('faqCopyStatus');
  if (!previewFrame) return;

  const html = buildFaqHtml();
  if (generatedHtml) generatedHtml.value = html;
  if ('srcdoc' in previewFrame) previewFrame.srcdoc = html;
  else previewFrame.innerHTML = html;
  if (copyStatus) copyStatus.textContent = '';
}

function renderEditor() {
  const editor = $('faqEditor');
  if (!editor) return;

  editor.innerHTML = state.items.map((item, index) => `
    <details class="faq-editor__item" data-index="${index}">
  <summary class="faq-editor__bar">
    <strong>Pergunta ${index + 1}</strong>
    <button class="copy-btn faq-remove-btn" type="button" data-action="remove">Remover</button>
  </summary>

  <div class="faq-editor__fields">
    <label class="faq-field">
      <span>Pergunta</span>
      <input type="text" value="${escapeHtml(item.question)}" data-field="question" autocomplete="off">
    </label>
    <label class="faq-field">
      <span>Resposta</span>
      <textarea data-field="answer">${escapeHtml(item.answer)}</textarea>
    </label>
  </div>
</details>
  `).join('');

  updateOutput();
}

function addItem() {
  state.items.push({ question: '', answer: '' });
  renderEditor();
  $('faqEditor')?.querySelector('.faq-editor__item:last-child input')?.focus();
}

function parseBulkFaq(value = '') {
  const normalized = value.replace(/\r\n?/g, '\n');
  const items = [];
  // Aceita blocos no formato <Q>pergunta</Q><A>resposta</A>.
  const pattern = /<Q>([\s\S]*?)<\/Q>[\s\S]*?<A>([\s\S]*?)<\/A>/gi;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const question = match[1].replace(/\s+/g, ' ').trim();
    const answer = match[2].trim();

    if (question || answer) {
      items.push({ question, answer });
    }
  }

  return items;
}

function fillFromBulk() {
  const bulkInput = $('faqBulkInput');
  const bulkStatus = $('faqBulkStatus');
  if (!bulkInput) return;

  const parsedItems = parseBulkFaq(bulkInput.value);

  if (!parsedItems.length) {
    if (bulkStatus) {
      bulkStatus.textContent = 'Não encontrei perguntas no formato <Q>Pergunta</Q> <A>Resposta</A>';
    }
    return;
  }

  state.items = parsedItems;

  if (bulkStatus) {
    bulkStatus.textContent = `${parsedItems.length} pergunta${parsedItems.length === 1 ? '' : 's'} preenchida${parsedItems.length === 1 ? '' : 's'}.`;
  }

  renderEditor();
}

async function copyGeneratedHtml() {
  const generatedHtml = $('faqGeneratedHtml');
  const copyStatus = $('faqCopyStatus');
  const html = generatedHtml?.value || buildFaqHtml();

  try {
    await navigator.clipboard.writeText(html);
  } catch {
    // Fallback para navegadores sem permissão direta de clipboard.
    const fallback = document.createElement('textarea');
    fallback.value = html;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.left = '-9999px';
    fallback.style.top = '0';
    document.body.appendChild(fallback);
    fallback.focus();
    fallback.select();
    document.execCommand('copy');
    fallback.remove();
  }

  if (copyStatus) {
    copyStatus.textContent = 'HTML copiado.';
    window.setTimeout(() => {
      copyStatus.textContent = '';
    }, 2400);
  }
}

function bindEvents() {
  $('faqEditor')?.addEventListener('input', event => {
    const field = event.target.dataset.field;
    if (!field) return;

    const itemElement = event.target.closest('.faq-editor__item');
    const index = Number(itemElement?.dataset.index);
    if (!Number.isFinite(index) || !state.items[index]) return;

    state.items[index][field] = event.target.value;
    updateOutput();
  });

  $('faqEditor')?.addEventListener('click', event => {
    const button = event.target.closest("[data-action='remove']");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    const itemElement = button.closest('.faq-editor__item');
    const index = Number(itemElement?.dataset.index);
    if (!Number.isFinite(index)) return;

    state.items.splice(index, 1);
    if (state.items.length === 0) state.items.push({ question: '', answer: '' });
    renderEditor();
  });

  $('faqAddItem')?.addEventListener('click', addItem);
  $('faqAddItemTop')?.addEventListener('click', addItem);
  $('faqFillFromBulk')?.addEventListener('click', fillFromBulk);
  $('faqCopyHtml')?.addEventListener('click', copyGeneratedHtml);
  $('faqCopyHtmlTop')?.addEventListener('click', copyGeneratedHtml);
}

export const FAQCreator = {
  init() {
    if (initialized) return;
    initialized = true;
    bindEvents();
    renderEditor();
  },
};
