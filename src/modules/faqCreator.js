const faqStyle = String.raw`<link rel="stylesheet" href="https://imgprd.martinsatacado.com.br/catalogoimg/catalogo/style-faq-padrao-tecnica.css?v=1">`;

const state = {
  items: [
    { question: '', answer: '' },
  ],
};

let initialized = false;
let saveTimer = null;
const DRAFT_KEY = 'fastseo_draft_faq';

const faqTitle = 'Dúvidas Frequentes';
const $ = id => document.getElementById(id);

function restoreDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (Array.isArray(saved) && saved.length) {
      state.items = saved
        .filter(item => item && typeof item.question === 'string' && typeof item.answer === 'string')
        .map(item => ({ question: item.question, answer: item.answer }));
    }
  } catch {
    // Um rascunho inválido não deve impedir o editor de abrir.
  }
}

function scheduleDraftSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state.items)); } catch { /* noop */ }
  }, 400);
}

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

function renderFaqItem(item, index) {
  const question = escapeHtml(item.question.trim());
  const answer = formatAnswer(item.answer);
  const suffix = index + 1;

  return `
<li id="faq-section__item-${suffix}" class="faq-section__item">
            <details id="faq-section__details-${suffix}" class="faq-section__details">
                <summary id="faq-section__summary-${suffix}" class="faq-section__summary">
                    <h3 id="faq-section__q-text-${suffix}" class="faq-section__q-text">${question}</h3>
                    <span id="faq-section__icon-${suffix}" class="faq-section__icon" aria-hidden="true"></span>
                </summary>

                <div id="faq-section__a-inner-${suffix}" class="faq-section__a-inner">
                    <p id="faq-section__a-text-${suffix}" class="faq-section__a-text">${answer}</p>
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

  return `
${faqStyle}
<section id="faq-section" aria-labelledby="faq-section__title">
<div id="faq-section__header">
<h2 id="faq-section__title">${escapeHtml(faqTitle)}</h2>
</div>
<ul id="faq-section__list" role="list">
${items}
</ul>
</section>`;
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
  const usedItems = state.items.filter(item => item.question.trim() || item.answer.trim());
  const validItems = usedItems.filter(item => item.question.trim() && item.answer.trim());
  const normalizedQuestions = validItems.map(item => item.question.trim().toLocaleLowerCase('pt-BR'));
  const hasDuplicate = normalizedQuestions.some((question, index) => normalizedQuestions.indexOf(question) !== index);
  const hasIncomplete = validItems.length !== usedItems.length;
  if (copyStatus) {
    copyStatus.textContent = hasDuplicate
      ? 'Existem perguntas duplicadas.'
      : hasIncomplete
        ? 'Complete pergunta e resposta antes de copiar.'
        : '';
    copyStatus.dataset.tone = hasDuplicate || hasIncomplete ? 'warning' : '';
  }
  const copyButton = $('faqCopyHtml');
  if (copyButton) {
    const ready = validItems.length > 0 && !hasDuplicate && !hasIncomplete;
    copyButton.disabled = !ready;
    copyButton.title = ready ? 'Copiar HTML gerado' : 'Preencha pares completos e sem perguntas duplicadas';
  }
}

function renderEditor() {
  const editor = $('faqEditor');
  if (!editor) return;

  editor.innerHTML = state.items.map((item, index) => `
    <details class="faq-editor__item" data-index="${index}"${index === 0 ? ' open' : ''}>
  <summary class="faq-editor__bar">
    <strong>Pergunta ${index + 1}</strong>
    <button class="copy-btn faq-remove-btn" type="button" data-action="remove" aria-label="Remover pergunta ${index + 1}"><i data-lucide="trash-2" aria-hidden="true"></i><span>Remover</span></button>
  </summary>

  <div class="faq-editor__fields">
    <label class="faq-field">
      <h3>Pergunta</h3>
      <input type="text" value="${escapeHtml(item.question)}" data-field="question" autocomplete="off">
    </label>
    <label class="faq-field">
      <p>Resposta</p>
      <textarea data-field="answer">${escapeHtml(item.answer)}</textarea>
    </label>
  </div>
</details>
  `).join('');

  updateOutput();
  window.requestAnimationFrame(() => window.lucide?.createIcons?.());
}

function addItem() {
  state.items.push({ question: '', answer: '' });
  scheduleDraftSave();
  renderEditor();
  $('faqEditor')?.querySelector('.faq-editor__item:last-child input')?.focus();
}

async function pasteBulkInput() {
  const bulkInput = $('faqBulkInput');
  const bulkStatus = $('faqBulkStatus');
  if (!bulkInput) return;

  try {
    if (!navigator.clipboard?.readText) {
      throw new Error('Leitura da área de transferência indisponível');
    }

    const clipboardText = await navigator.clipboard.readText();
    bulkInput.value = clipboardText;
    bulkInput.dispatchEvent(new Event('input', { bubbles: true }));
    bulkInput.focus();

    if (bulkStatus) {
      bulkStatus.textContent = clipboardText
        ? 'Texto colado. Clique em Preencher campos para continuar.'
        : 'A área de transferência está vazia.';
      bulkStatus.dataset.tone = clipboardText ? 'success' : 'warning';
    }
  } catch (err) {
    if (bulkStatus) {
      bulkStatus.textContent = 'Não foi possível colar automaticamente. Use Ctrl+V no campo de texto.';
      bulkStatus.dataset.tone = 'error';
    }
    bulkInput.focus();
    console.warn('FAQCreator clipboard:', err);
  }
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

  if (items.length) return items;

  // Também aceita blocos numerados com rótulos Pergunta/Resposta.
  const blocks = normalized
    .split(/(?=^\s*\d+[.)-]?\s*(?:pergunta\s*[:\-]|[^\n]+\?))/gim)
    .map(block => block.trim())
    .filter(Boolean);

  blocks.forEach(block => {
    const labelled = block.match(/^\s*\d+[.)-]?\s*(?:pergunta\s*[:\-]\s*)?(.+?\?)\s*(?:\n|\r)+\s*(?:resposta\s*[:\-]\s*)?([\s\S]+)$/i);
    if (!labelled) return;
    const question = labelled[1].replace(/\s+/g, ' ').trim();
    const answer = labelled[2].replace(/^\s*(?:resposta\s*[:\-]\s*)/i, '').trim();
    if (question && answer) items.push({ question, answer });
  });

  return items;
}

function fillFromBulk() {
  const bulkInput = $('faqBulkInput');
  const bulkStatus = $('faqBulkStatus');
  if (!bulkInput) return;

  const parsedItems = parseBulkFaq(bulkInput.value);

  if (!parsedItems.length) {
    if (bulkStatus) {
      bulkStatus.textContent = 'Não encontrei pares válidos. Use tags <Q>/<A> ou uma lista numerada com Pergunta e Resposta.';
      bulkStatus.dataset.tone = 'error';
    }
    return;
  }

  state.items = parsedItems;
  scheduleDraftSave();

  if (bulkStatus) {
    bulkStatus.textContent = `${parsedItems.length} pergunta${parsedItems.length === 1 ? '' : 's'} preenchida${parsedItems.length === 1 ? '' : 's'}.`;
    bulkStatus.dataset.tone = 'success';
  }

  renderEditor();
  setEditorMode('manual');
}

function setEditorMode(mode) {
  const bulk = mode === 'bulk';
  const bulkTab = $('faqBulkTab');
  const manualTab = $('faqManualTab');
  const bulkPanel = $('faqBulkPanel');
  const manualPanel = $('faqManualPanel');
  bulkTab?.classList.toggle('is-active', bulk);
  manualTab?.classList.toggle('is-active', !bulk);
  bulkTab?.setAttribute('aria-selected', String(bulk));
  manualTab?.setAttribute('aria-selected', String(!bulk));
  if (bulkPanel) bulkPanel.hidden = !bulk;
  if (manualPanel) manualPanel.hidden = bulk;
}

function setOutputMode(mode) {
  const preview = mode === 'preview';
  const previewTab = $('faqPreviewTab');
  const htmlTab = $('faqHtmlTab');
  const previewShell = document.querySelector('#faqWorkspace .faq-preview-shell');
  const generatedHtml = $('faqGeneratedHtml');
  previewTab?.classList.toggle('is-active', preview);
  htmlTab?.classList.toggle('is-active', !preview);
  previewTab?.setAttribute('aria-selected', String(preview));
  htmlTab?.setAttribute('aria-selected', String(!preview));
  if (previewShell) previewShell.hidden = !preview;
  if (generatedHtml) generatedHtml.hidden = preview;
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
    scheduleDraftSave();
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
    scheduleDraftSave();
    renderEditor();
  });

  $('faqAddItem')?.addEventListener('click', addItem);
  $('faqPasteBulk')?.addEventListener('click', pasteBulkInput);
  $('faqFillFromBulk')?.addEventListener('click', fillFromBulk);
  $('faqCopyHtml')?.addEventListener('click', copyGeneratedHtml);
  $('faqBulkTab')?.addEventListener('click', () => setEditorMode('bulk'));
  $('faqManualTab')?.addEventListener('click', () => setEditorMode('manual'));
  $('faqPreviewTab')?.addEventListener('click', () => setOutputMode('preview'));
  $('faqHtmlTab')?.addEventListener('click', () => setOutputMode('html'));
}

export const FAQCreator = {
  init() {
    if (initialized) return;
    initialized = true;
    restoreDraft();
    bindEvents();
    renderEditor();
  },
};
