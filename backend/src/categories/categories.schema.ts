import { z } from 'zod';
import { CATEGORY_PROFILE_TYPES, CATEGORY_STATUSES } from './types.js';

const text = (max = 160) => z.string().trim().min(1).max(max);
const optionalText = (max = 5000) => z.string().trim().max(max).default('');
const stringList = (maxItems = 80) => z.array(text(160)).max(maxItems).default([]);

export const categoryModifierSchema = z.object({
  id: text(100).regex(/^[a-z0-9][a-z0-9_-]*$/),
  name: text(120),
  aliases: stringList(40),
  negativeTerms: stringList(30),
  addRequiredFields: stringList(50),
  addOptionalFields: stringList(80),
  titleSuffix: optionalText(500),
});

export const categoryProfileInputSchema = z.object({
  name: text(120),
  status: z.enum(CATEGORY_STATUSES).default('draft'),
  profileType: z.enum(CATEGORY_PROFILE_TYPES).default('compact'),
  parentId: z.string().trim().max(100).regex(/^[a-zA-Z0-9_-]+$/).nullable().default(null),
  aliases: stringList(50),
  negativeTerms: stringList(40),
  requiredFields: stringList(80),
  optionalFields: stringList(120),
  idealSheet: optionalText(20000),
  sheetNoticeType: z.string().trim().max(80).default('normal'),
  titleRule: z.object({
    formula: optionalText(1000),
    example: optionalText(1000),
  }).default({ formula: '', example: '' }),
  modifiers: z.array(categoryModifierSchema).max(50).default([]),
  qaSchema: z.record(z.string(), z.unknown()).nullable().default(null),
  schemaVersion: z.number().int().min(2).max(100).default(2),
  source: z.enum(['manual', 'legacy-migration', 'import']).default('manual'),
});

export const categoryProfilePatchSchema = categoryProfileInputSchema.partial().refine(
  value => Object.keys(value).length > 0,
  'Informe ao menos um campo para atualizar.',
);

export const categoryIdSchema = z.object({
  id: text(100).regex(/^[a-zA-Z0-9_-]+$/),
});

export const categoryResolveSchema = z.object({
  input: z.string().trim().min(2).max(20000),
});

export const categoryImportSchema = z.object({
  profiles: z.array(categoryProfileInputSchema.extend({
    id: z.string().trim().max(100).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  })).min(1).max(200),
});
