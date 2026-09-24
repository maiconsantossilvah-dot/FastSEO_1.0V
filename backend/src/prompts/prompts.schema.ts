import { z } from 'zod';

export const PROMPT_KEYS = ['P1', 'P2', 'P3', 'P1B', 'P2B', 'P3B'] as const;

export const promptKeySchema = z.object({
  key: z.enum(PROMPT_KEYS),
}).strict();

export const promptUpdateSchema = z.object({
  value: z.string().trim().min(1).max(20_000),
}).strict();

export type PromptKey = (typeof PROMPT_KEYS)[number];
