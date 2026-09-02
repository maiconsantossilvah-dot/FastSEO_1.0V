import { describe, expect, it } from 'vitest';
import {
  buildExportWithFaqPrompt,
  EXPORT_WITH_FAQ_PROMPT,
} from '../../src/modules/exportPrompt.js';

describe('prompt de exportação', () => {
  it('mantém integralmente as regras editoriais fornecidas', () => {
    expect(EXPORT_WITH_FAQ_PROMPT.length).toBeGreaterThan(13_000);
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('CAMPO 1 — DESCRIÇÃO RESUMIDA (Palavra-chave)');
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('# Prompt Mestre — FAQ SEO para E-commerce');
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('REGRA MAIS IMPORTANTE — PROIBIDO INVENTAR');
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('Não é para trazer as perguntas enumeradas.');
  });

  it('mantém o contrato dos três blocos de saída', () => {
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('DESCRIÇÃO RESUMIDA');
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('META DESCRIPTION');
    expect(EXPORT_WITH_FAQ_PROMPT).toContain('FAQ');
  });

  it('separa o prompt da ficha sem modificar o texto técnico', () => {
    const ficha = 'CÓDIGO: 123\nProduto de teste';
    const output = buildExportWithFaqPrompt(ficha);

    expect(output.startsWith(EXPORT_WITH_FAQ_PROMPT)).toBe(true);
    expect(output.endsWith(ficha)).toBe(true);
    expect(output).toContain(`FAQ\n\n${ficha}`);
  });
});
