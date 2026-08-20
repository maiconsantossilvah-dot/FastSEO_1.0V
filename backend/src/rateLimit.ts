import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';

interface RateLimitOptions {
  windowMs?: number;
  limit?: number;
}

export function createApiRateLimiter(options: RateLimitOptions = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? config.rateLimitWindowMs,
    limit: options.limit ?? config.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas solicitações em pouco tempo. Aguarde e tente novamente.',
      },
    },
  });
}

export const apiRateLimiter = createApiRateLimiter();
