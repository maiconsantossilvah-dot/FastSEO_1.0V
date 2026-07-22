const faqStyle = String.raw`<style>
/*inicio-area-de-faq*/
#faq-section,
#faq-section * {
box-sizing: border-box;
}

#faq-section * {
padding: 0;
margin: 0;
}

#faq-section {
width: 100%;
padding: 0rem 16px;
box-sizing: border-box;
margin: -10px auto 25px;
font-family: sans-serif;
}

#faq-section__header {
color: #f1f1f1;
margin: 0 0 12px;
font-size: 14px;
line-height: 24px;
letter-spacing: 0.15px;
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Helvetica, "Noto Sans", "Liberation Sans", Arial, sans-serif;
font-weight: 400;
text-decoration: none;
}

#faq-section__title {
text-align: center;
align-items: flex-start;
background: rgb(0, 157, 255);
border-radius: 4px;
color: rgb(255, 255, 255);
display: flex;
flex-direction: row;
height: 40px;
margin: 0 0 8px;
padding: 8px;
width: 100%;
box-sizing: border-box;
}

#faq-section__list {
list-style: none;
margin: 0 auto;
padding: 0;
display: flex;
flex-direction: column;
gap: 8px;
}

#faq-section__item {
background: #fff;
border: 1px solid #e5e5e5;
border-radius: 12px;
overflow: hidden;
}

#faq-section__item summary {
display: flex;
align-items: center;
justify-content: space-between;
gap: 12px;
padding: 16px 20px;
cursor: pointer;
list-style: none;
transition: background 0.15s ease;
}

#faq-section__item summary::-webkit-details-marker {
display: none;
}

#faq-section__item summary:hover {
background: #f9f9f9;
}

#faq-section__item summary:focus-visible {
outline: 2px solid #ea5b0c;
outline-offset: -2px;
border-radius: 12px;
}

#faq-section__q-text {
font-size: 14px;
font-weight: bold;
color: #333;
flex: 1;
margin: 0;
transition: color 0.15s ease;
}

#faq-section__icon {
width: 20px;
height: 20px;
flex-shrink: 0;
position: relative;
}

#faq-section__icon::before,
#faq-section__icon::after {
content: '';
position: absolute;
background: rgb(46, 53, 56);
border-radius: 2px;
transition: transform 0.25s ease, opacity 0.25s ease;
}

#faq-section__icon::before {
width: 12px;
height: 1.5px;
top: 9px;
left: 4px;
}

#faq-section__icon::after {
width: 1.5px;
height: 12px;
top: 4px;
left: 9px;
}

#faq-section__item details[open] #faq-section__icon::after {
transform: rotate(90deg);
opacity: 0;
}

#faq-section__a-inner {
padding: 14px 20px 16px;
border-top: 1px solid #e5e5e5;
}

#faq-section__a-text {
font-size: 12px;
color: rgb(46, 53, 56);
line-height: 1.6;
margin: 0;
}

@media (max-width: 480px) {
#faq-section__q-text {
font-size: 0.9rem;
}
}
/*final-area-de-faq*/
</style>`;

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

  return `        <!-- Cole aqui as perguntas e respostas -->
        <li id="faq-section__item">
<details>
<summary>
<h3 id="faq-section__q-text"> ${question} </h3>
<span id="faq-section__icon" aria-hidden="true"></span>
</summary>
<div id="faq-section__a-inner">
<p id="faq-section__a-text"> ${answer} </p>
</div>
</details>
</li>
        <!-------------------------->`;
}


// Monta o HTML final que será copiado para uso externo.
function buildFaqHtml() {
  const items = state.items
    .filter(item => item.question.trim() || item.answer.trim())
    .map(renderFaqItem)
    .join('\n\n');

  return `<meta charset="UTF-8">
<section id="faq-section" aria-labelledby="faq-section__title">
<div id="faq-section__header">
<h2 id="faq-section__title">${escapeHtml(faqTitle)}</h2>
</div>
<ul id="faq-section__list" role="list">
${items}
</ul>
</section>

<!-- ESSES CÓDIGOS ABAIXO VOCÊ NÃO PRECISA MEXER!!! APENAS O HTML ACIMA-->

${faqStyle}`;
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
    <details class="faq-editor__item faq-editor__item--dropdown" data-index="${index}">
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
