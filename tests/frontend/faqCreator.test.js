// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { FAQCreator } from '../../src/modules/faqCreator.js';

describe('FAQCreator', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <button id="faqAddItem" type="button"></button>
      <button id="faqPasteBulk" type="button"></button>
      <button id="faqFillFromBulk" type="button"></button>
      <button id="faqCopyHtml" type="button"></button>
      <button id="faqPreviewTab" type="button"></button>
      <button id="faqHtmlTab" type="button"></button>
      <section id="faqBulkPanel">
        <textarea id="faqBulkInput"></textarea>
        <span id="faqBulkStatus"></span>
      </section>
      <section id="faqManualPanel">
        <div id="faqEditor"></div>
      </section>
      <div id="faqCopyStatus"></div>
      <textarea id="faqGeneratedHtml"></textarea>
    `;
  });

  it('mantém as entradas juntas, recolhe itens preenchidos e abre um novo item', () => {
    FAQCreator.init();

    expect(document.getElementById('faqBulkPanel').hidden).toBe(false);
    expect(document.getElementById('faqManualPanel').hidden).toBe(false);
    expect(document.querySelector('.faq-editor__item').open).toBe(true);

    document.getElementById('faqBulkInput').value = `
      <Q>Qual é a primeira pergunta?</Q><A>Primeira resposta.</A>
      <Q>Qual é a segunda pergunta?</Q><A>Segunda resposta.</A>
    `;
    document.getElementById('faqFillFromBulk').click();

    const importedItems = [...document.querySelectorAll('.faq-editor__item')];
    expect(importedItems).toHaveLength(2);
    expect(importedItems.every(item => !item.open)).toBe(true);

    document.getElementById('faqAddItem').click();

    const itemsWithNewEntry = [...document.querySelectorAll('.faq-editor__item')];
    expect(itemsWithNewEntry).toHaveLength(3);
    expect(itemsWithNewEntry.slice(0, -1).every(item => !item.open)).toBe(true);
    expect(itemsWithNewEntry.at(-1).open).toBe(true);
  });
});
