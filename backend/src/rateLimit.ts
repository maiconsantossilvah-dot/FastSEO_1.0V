import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import type { AuthenticatedRequest } from './auth/types.js';

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

// Aplicado depois da autenticação. Evita que toda a equipe compartilhe a mesma
// cota quando estiver atrás do mesmo IP corporativo.
export const userMutationRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  limit: config.userRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator(request) {
    return (request as AuthenticatedRequest).currentUser?.uid || ipKeyGenerator(request.ip || '');
  },
  message: {
    error: {
      code: 'USER_RATE_LIMIT_EXCEEDED',
      message: 'Você atingiu o limite temporário de alterações. Aguarde e tente novamente.',
    },
  },
});
