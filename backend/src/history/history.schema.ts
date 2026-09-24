import { z } from 'zod';
import { usageCallSchema } from '../usage/usage.schema.js';

const summaryTokenCount = z.number().int().min(0).max(32_000_000);

export const tokenUsageSummarySchema = z.object({
  calls: z.array(usageCallSchema).max(16),
  requestCount: z.number().int().min(0).max(16),
  inputTokens: summaryTokenCount,
  outputTokens: summaryTokenCount,
  thinkingTokens: summaryTokenCount,
  cachedTokens: summaryTokenCount,
  totalTokens: summaryTokenCount,
}).strict().superRefine((summary, context) => {
  const totals = summary.calls.reduce((result, call) => ({
    requestCount: result.requestCount + 1,
    inputTokens: result.inputTokens + call.inputTokens,
    outputTokens: result.outputTokens + call.outputTokens,
    thinkingTokens: result.thinkingTokens + call.thinkingTokens,
    cachedTokens: result.cachedTokens + call.cachedTokens,
    totalTokens: result.totalTokens + call.totalTokens,
  }), { requestCount: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, cachedTokens: 0, totalTokens: 0 });

  for (const [field, expected] of Object.entries(totals)) {
    if (summary[field as keyof typeof totals] !== expected) {
      context.addIssue({ code: 'custom', path: [field], message: `${field} não corresponde às chamadas informadas.` });
    }
  }
});

export const historyCreateSchema = z.object({
  preview: z.string().max(500).default(''),
  ficha: z.string().max(50_000).default(''),
  conteudo: z.string().max(50_000).default(''),
  bivolt: z.boolean().default(false),
  tokenUsage: tokenUsageSummarySchema.nullable().default(null),
}).strict();

export const historyUpdateSchema = z.object({
  conteudo: z.string().max(50_000),
  tokenUsage: tokenUsageSummarySchema.nullable().default(null),
}).strict();

export const historyIdSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
}).strict();

export type HistoryCreateInput = z.infer<typeof historyCreateSchema>;
export type HistoryUpdateInput = z.infer<typeof historyUpdateSchema>;
