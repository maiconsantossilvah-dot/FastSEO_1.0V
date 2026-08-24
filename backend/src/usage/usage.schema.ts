import { z } from 'zod';

const tokenCount = z.number().int().min(0).max(100_000_000);

export const usageCallSchema = z.object({
  stage: z.number().int().min(1).max(3),
  provider: z.enum(['gemini', 'mistral']),
  model: z.string().trim().min(1).max(120),
  kind: z.enum(['generation', 'regeneration']).default('generation'),
  inputTokens: tokenCount,
  outputTokens: tokenCount,
  thinkingTokens: tokenCount.default(0),
  cachedTokens: tokenCount.default(0),
  totalTokens: tokenCount,
}).strict();

export const usageEventSchema = z.object({
  eventId: z.string().trim().min(16).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  status: z.enum(['aprovado', 'reprovado', 'erro']),
  durationMs: z.number().int().min(0).max(3_600_000),
  category: z.string().trim().max(120).default(''),
  bivolt: z.boolean().default(false),
  calls: z.array(usageCallSchema).min(1).max(8),
}).strict();

export const usageAnalyticsQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
}).superRefine((range, context) => {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T00:00:00.000Z`);
  if (from > to) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'A data inicial deve ser anterior à final.' });
    return;
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days > 366) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'O período máximo é de 366 dias.' });
  }
});

export type UsageCallInput = z.infer<typeof usageCallSchema>;
export type UsageEventInput = z.infer<typeof usageEventSchema>;
export type UsageAnalyticsQuery = z.infer<typeof usageAnalyticsQuerySchema>;
