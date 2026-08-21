import type { CategoryProfileType } from '../categories/types.js';

export const FACT_CONFIDENCES = ['high', 'medium', 'low'] as const;
export const FACT_SCOPES = ['common', '110v', '220v'] as const;

export type FactConfidence = (typeof FACT_CONFIDENCES)[number];
export type FactScope = (typeof FACT_SCOPES)[number];

export interface ExtractedFact {
  field: string;
  value: string;
  sourceLines: number[];
  confidence: FactConfidence;
  scope: FactScope;
}

export interface ExtractedProduct {
  productName: string;
  brand: string;
  model: string;
  color: string;
  codes: string[];
  eans: string[];
  supplier: string;
  facts: ExtractedFact[];
}

export interface CompactCategoryContract {
  id: string;
  name: string;
  profileType: CategoryProfileType;
  requiredFields: string[];
  optionalFields: string[];
  titleFormula: string;
  titleExample: string;
  sheetNoticeType: string;
  modifiers: string[];
  catalogVersion: number;
  resolutionConfidence: number;
}

export interface ValidationIssue {
  code: string;
  field?: string;
  message: string;
  severity: 'warning' | 'risk';
}

export interface DeterministicValidation {
  issues: ValidationIssue[];
  missingRequired: string[];
  confirmedFields: string[];
  needsAiReview: boolean;
  reviewReasons: string[];
}
