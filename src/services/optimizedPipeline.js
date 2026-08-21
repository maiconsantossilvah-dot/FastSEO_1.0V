import { UserAccess, UsersApiError } from './userAccess.js';

const FALLBACK_CODES = new Set(['NOT_FOUND', 'BACKEND_UNAVAILABLE']);

export const OptimizedPipeline = {
  prepare(input) {
    return UserAccess.request('/pipeline/prepare', {
      method: 'POST',
      body: JSON.stringify({ input }),
    });
  },

  compose({ input, extraction, review = null, seoKeywords = [] }) {
    return UserAccess.request('/pipeline/compose', {
      method: 'POST',
      body: JSON.stringify({ input, extraction, review, seoKeywords }),
    });
  },

  canFallback(error) {
    return error instanceof UsersApiError && FALLBACK_CODES.has(error.code);
  },
};
