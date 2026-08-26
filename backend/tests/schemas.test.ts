import { describe, expect, it } from 'vitest';
import {
  categoryProfilePatchSchema,
  categoryResolveSchema,
} from '../src/categories/categories.schema.js';
import { usageCallSchema, usageEventSchema } from '../src/usage/usage.schema.js';
import { previewProfiles } from '../src/categories/categories.service.js';
import type { CategoryProfile } from '../src/categories/types.js';
import { matchTitleRule } from '../src/titleRules/titleRules.service.js';

function profile(id: string, parentId: string | null = null): CategoryProfile {
  return {
    id,
    name: id,
    parentId,
    status: 'draft',
    profileType: 'compact',
    aliases: [],
    negativeTerms: [],
    requiredFields: [],
    optionalFields: [],
    idealSheet: '',
    sheetNoticeType: 'normal',
    titleRule: { formula: '', example: '' },
    modifiers: [],
    qaSchema: null,
    schemaVersion: 2,
    revision: 1,
    source: 'import',
  };
}

describe('schemas de categorias', () => {
  it('exige a revisão lida pelo cliente ao atualizar', () => {
    expect(categoryProfilePatchSchema.safeParse({ name: 'Garrafa' }).success).toBe(false);
    expect(categoryProfilePatchSchema.safeParse({ name: 'Garrafa', expectedRevision: 3 }).success).toBe(true);
  });

  it('aceita fichas de até 20 mil caracteres no resolvedor', () => {
    expect(categoryResolveSchema.safeParse({ input: 'x'.repeat(20_000) }).success).toBe(true);
    expect(categoryResolveSchema.safeParse({ input: 'x'.repeat(20_001) }).success).toBe(false);
  });

  it('rejeita pai ausente e ciclo antes de importar', () => {
    const missingParent = previewProfiles([profile('filha', 'inexistente')], []);
    expect(missingParent.conflicts.some(item => item.reason.includes('não encontrada'))).toBe(true);

    const cycle = previewProfiles([profile('a', 'b'), profile('b', 'a')], []);
    expect(cycle.conflicts.some(item => item.reason.includes('ciclo'))).toBe(true);
  });
});

describe('schemas de telemetria', () => {
  const validCall = {
    stage: 1,
    provider: 'gemini',
    model: 'gemini-test',
    inputTokens: 100,
    outputTokens: 20,
    thinkingTokens: 0,
    cachedTokens: 0,
    totalTokens: 120,
  };

  it('rejeita total de tokens incompatível', () => {
    expect(usageCallSchema.safeParse({ ...validCall, totalTokens: 10 }).success).toBe(false);
  });

  it('rejeita campos extras no evento recebido do navegador', () => {
    const result = usageEventSchema.safeParse({
      eventId: 'event_1234567890123456',
      status: 'aprovado',
      durationMs: 1000,
      category: 'Celular',
      bivolt: false,
      calls: [validCall],
      forgedField: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('resolução de regra de título', () => {
  it('seleciona a regra no mesmo matcher usado pelo backend', () => {
    const result = matchTitleRule('Garrafa térmica inox 1 litro', [
      { id: 'garrafa-termica', name: 'Garrafa Térmica', formula: 'Produto + Marca', example: '', source: 'manual', revision: 1 },
      { id: 'smartphone', name: 'Smartphone', formula: 'Produto + Marca + Modelo', example: '', source: 'manual', revision: 1 },
    ]);
    expect(result?.id).toBe('garrafa-termica');
  });
});
