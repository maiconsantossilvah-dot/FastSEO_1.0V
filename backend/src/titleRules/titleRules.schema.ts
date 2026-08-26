import { z } from 'zod';

const ruleInput = z.object({
  name: z.string().trim().min(1).max(160),
  formula: z.string().trim().min(1).max(2000),
  example: z.string().trim().max(2000).default(''),
}).strict();

export const titleRuleSchema = ruleInput;
export const titleRuleIdSchema = z.object({
  id: z.string().trim().min(1).max(160).regex(/^[a-zA-Z0-9_-]+$/),
});
export const titleRuleImportSchema = z.object({
  replace: z.boolean().default(false),
  rules: z.array(ruleInput).min(1).max(300),
}).strict();

export type TitleRuleInput = z.infer<typeof titleRuleSchema>;
