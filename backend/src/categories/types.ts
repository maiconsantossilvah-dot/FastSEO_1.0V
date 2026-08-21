export const CATEGORY_STATUSES = ['draft', 'published', 'archived'] as const;
export const CATEGORY_PROFILE_TYPES = ['compact', 'technical', 'generic'] as const;

export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];
export type CategoryProfileType = (typeof CATEGORY_PROFILE_TYPES)[number];

export interface CategoryTitleRule {
  formula: string;
  example: string;
}

export interface CategoryModifier {
  id: string;
  name: string;
  aliases: string[];
  negativeTerms: string[];
  addRequiredFields: string[];
  addOptionalFields: string[];
  titleSuffix: string;
}

export interface CategoryProfile {
  id: string;
  name: string;
  status: CategoryStatus;
  profileType: CategoryProfileType;
  parentId: string | null;
  aliases: string[];
  negativeTerms: string[];
  requiredFields: string[];
  optionalFields: string[];
  idealSheet: string;
  sheetNoticeType: string;
  titleRule: CategoryTitleRule;
  modifiers: CategoryModifier[];
  qaSchema: Record<string, unknown> | null;
  schemaVersion: number;
  revision: number;
  source: 'manual' | 'legacy-migration' | 'import';
  createdAt?: unknown;
  createdBy?: string;
  updatedAt?: unknown;
  updatedBy?: string;
  publishedAt?: unknown;
  publishedBy?: string;
  publishedVersion?: number;
}

export interface CategoryResolution {
  family: { id: string; name: string };
  modifiers: Array<{ id: string; name: string }>;
  confidence: number;
  score: number;
  evidence: string[];
  compiledProfile: CategoryProfile;
  catalogVersion: number;
}
