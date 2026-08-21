import { z } from 'zod';
import { FACT_CONFIDENCES, FACT_SCOPES } from './types.js';

const shortText = z.string().trim().max(500).default('');

export const pipelinePrepareSchema = z.object({
  input: z.string().trim().min(2).max(12000),
});

export const pipelineComposeSchema = pipelinePrepareSchema.extend({
  extraction: z.union([z.string().trim().min(2).max(30000), z.record(z.string(), z.unknown())]),
  review: z.union([z.string().trim().min(2).max(12000), z.record(z.string(), z.unknown())]).nullable().default(null),
  seoKeywords: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
});

export const extractedFactSchema = z.object({
  field: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(1000),
  sourceLines: z.array(z.number().int().min(1).max(500)).min(1).max(8),
  confidence: z.enum(FACT_CONFIDENCES),
  scope: z.enum(FACT_SCOPES).default('common'),
});

export const extractedProductSchema = z.object({
  productName: shortText,
  brand: shortText,
  model: shortText,
  color: shortText,
  codes: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  eans: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  supplier: shortText,
  facts: z.array(extractedFactSchema).max(100).default([]),
});

export const aiReviewSchema = z.object({
  status: z.enum(['APROVADO', 'REPROVADO']),
  confidence: z.enum(['ALTA', 'MEDIA', 'BAIXA']),
  summary: z.string().trim().min(1).max(500),
  errors: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
});

export type PipelinePrepareRequest = z.infer<typeof pipelinePrepareSchema>;
export type PipelineComposeRequest = z.infer<typeof pipelineComposeSchema>;
export type AiReview = z.infer<typeof aiReviewSchema>;
