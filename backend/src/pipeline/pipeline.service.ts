import { AppError } from '../errors.js';
import { resolvePublishedCategory } from '../categories/categories.service.js';
import { aiReviewSchema, extractedProductSchema, type AiReview, type PipelineComposeRequest, type PipelinePrepareRequest } from './pipeline.schema.js';
import {
  a1Prompts, a2Prompts, a3Prompts, cleanPipelineInput, compactCategoryContract,
  numberedInputLines, renderTechnicalSheet, validateExtractedProduct,
} from './pipeline.core.js';

export const PIPELINE_VERSION = '2.0.0';

function jsonValue(raw: string | Record<string, unknown>): unknown {
  if (typeof raw !== 'string') return raw;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch {}
  }
  throw new AppError(422, 'AI_INVALID_JSON', 'A IA não retornou o JSON estruturado esperado.');
}

export function extractionOutputBudget(profileType: string | undefined, inputLength = 0): number {
  const base = profileType === 'technical' ? 6000 : profileType === 'compact' ? 2600 : 4200;
  const inputAdjustment = Math.min(2000, Math.floor(Math.max(0, inputLength) / 4000) * 400);
  return Math.min(8192, base + inputAdjustment);
}

function compatibilityQa(
  review: AiReview | null,
  validation: ReturnType<typeof validateExtractedProduct>,
  categoryName = '',
) {
  const warnings = validation.issues.filter(issue => issue.severity === 'warning').map(issue => issue.message);
  const errors = review?.errors || [];
  const status = review?.status || 'APROVADO';
  return {
    status,
    confianca: review?.confidence || (warnings.length ? 'MEDIA' : 'ALTA'),
    resumo: review?.summary || (warnings.length ? 'Validação determinística concluída com avisos.' : 'Validação determinística concluída sem riscos.'),
    erros: errors,
    avisos: [...warnings, ...(review?.warnings || [])],
    campos_confirmados: validation.confirmedFields,
    campos_ausentes: validation.missingRequired,
    campos_inferidos: [],
    seo: { status: 'INDEFINIDO', avisos: [], termos_validos: [], termos_suspeitos: [] },
    category_validation: {
      category: categoryName,
      schema_version: PIPELINE_VERSION,
      checked_fields: validation.confirmedFields,
      failed_rules: errors,
      warnings: [...warnings, ...(review?.warnings || [])],
    },
  };
}

function categorySummary(contract: ReturnType<typeof compactCategoryContract>) {
  return contract ? {
    id: contract.id,
    name: contract.name,
    profileType: contract.profileType,
    catalogVersion: contract.catalogVersion,
  } : null;
}

export async function prepareProduct(input: PipelinePrepareRequest) {
  const cleanInput = cleanPipelineInput(input.input);
  const lines = numberedInputLines(cleanInput);
  const { resolution } = await resolvePublishedCategory(cleanInput);
  const contract = compactCategoryContract(resolution);
  const prompt = a1Prompts(lines, contract);
  return {
    pipelineVersion: PIPELINE_VERSION,
    category: categorySummary(contract),
    bivolt: /(?<!\d)(110|127)\s*v(?!\d)/i.test(cleanInput) && /(?<!\d)(220|240)\s*v(?!\d)/i.test(cleanInput),
    extraction: { ...prompt, maxOutputTokens: extractionOutputBudget(contract?.profileType, cleanInput.length), jsonMode: true },
  };
}

export async function composeProduct(input: PipelineComposeRequest) {
  const cleanInput = cleanPipelineInput(input.input);
  const lines = numberedInputLines(cleanInput);
  const { resolution } = await resolvePublishedCategory(cleanInput);
  const contract = compactCategoryContract(resolution);
  const product = extractedProductSchema.parse(jsonValue(input.extraction));
  const validation = validateExtractedProduct(product, lines, contract);

  if (validation.needsAiReview && !input.review) {
    const prompt = a2Prompts(lines, product, validation);
    return {
      phase: 'review_required' as const,
      pipelineVersion: PIPELINE_VERSION,
      category: categorySummary(contract),
      validation: { aiReviewUsed: true, reasons: validation.reviewReasons },
      review: { ...prompt, maxOutputTokens: 500, jsonMode: true },
    };
  }

  const review = input.review ? aiReviewSchema.parse(jsonValue(input.review)) : null;
  const qa = compatibilityQa(review, validation, contract?.name);
  const copyPrompt = qa.status === 'REPROVADO' ? null : a3Prompts(product, input.seoKeywords);
  return {
    phase: 'complete' as const,
    pipelineVersion: PIPELINE_VERSION,
    ficha: renderTechnicalSheet(product, contract, validation),
    qa,
    reprovado: qa.status === 'REPROVADO',
    bivolt: /(?<!\d)(110|127)\s*v(?!\d)/i.test(cleanInput) && /(?<!\d)(220|240)\s*v(?!\d)/i.test(cleanInput),
    category: categorySummary(contract),
    validation: { aiReviewUsed: validation.needsAiReview, reasons: validation.reviewReasons },
    copy: copyPrompt ? { ...copyPrompt, maxOutputTokens: 550, jsonMode: false } : null,
  };
}
