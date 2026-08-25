import { describe, expect, it, vi } from 'vitest';
import { sanitizeInput } from '../../src/utils/sanitizeInput.js';
import { prepareProductInput } from '../../src/utils/prepareProductInput.js';
import { Utils } from '../../src/utils/index.js';

describe('sanitizeInput', () => {
  it('remove tags, caracteres de controle e esquemas inseguros', () => {
    const result = sanitizeInput('  <b>Produto</b>\u0000 javascript:teste   127 V  ');

    expect(result.text).toBe('Produto teste  127 V');
    expect(result.truncated).toBe(false);
  });

  it('preserva EAN, modelo e medidas do produto', () => {
    const source = 'EAN: 7892509150538\nModelo: A276B\nDimensões: 162,4 x 78,2 x 7,8 mm';
    expect(sanitizeInput(source).text).toBe(source);
  });

  it('trunca no limite informado e devolve metadados', () => {
    const result = sanitizeInput('1234567890', { maxChars: 6 });

    expect(result).toMatchObject({
      text: '123456',
      truncated: true,
      originalLength: 10,
      sanitizedLength: 6,
      maxChars: 6,
    });
  });

  it('mantém o aviso legado de Utils.sanitize quando excede 20 mil caracteres', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = Utils.sanitize('A'.repeat(20001));

    expect(result).toHaveLength(20000);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('prepareProductInput', () => {
  it('sanitiza e compacta linhas vazias sem reorganizar os dados', () => {
    const result = prepareProductInput('<b>Produto</b>\r\n\r\n\r\nEAN: 123');

    expect(result.text).toBe('Produto\n\nEAN: 123');
    expect(result.warnings).toEqual([]);
  });

  it('expõe aviso estruturado quando precisa truncar', () => {
    const result = prepareProductInput('ABCDEFGHIJ', { maxChars: 5 });

    expect(result.text).toBe('ABCDE');
    expect(result.meta.truncated).toBe(true);
    expect(result.warnings[0].code).toBe('INPUT_TRUNCATED');
  });
});
