import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/utils/html.js';
import { Utils } from '../../src/utils/index.js';

describe('escapeHtml', () => {
  it('escapa tags, entidades e ambos os tipos de aspas', () => {
    expect(escapeHtml(`<img title="x" data-value='y'>&`))
      .toBe('&lt;img title=&quot;x&quot; data-value=&#039;y&#039;&gt;&amp;');
  });

  it('mantém a API compatível em Utils.escHtml', () => {
    expect(Utils.escHtml('A&B <produto>')).toBe('A&amp;B &lt;produto&gt;');
  });

  it('aceita valores nulos sem renderizar as palavras null ou undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
