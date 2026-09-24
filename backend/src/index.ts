import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { AppError, errorHandler, notFoundHandler } from './errors.js';
import { apiRateLimiter } from './rateLimit.js';
import { usersRouter } from './users/users.routes.js';
import { categoriesRouter } from './categories/categories.routes.js';
import { usageRouter } from './usage/usage.routes.js';
import { titleRulesRouter } from './titleRules/titleRules.routes.js';
import { adminDb } from './firebaseAdmin.js';
import { asyncRoute } from './http/asyncRoute.js';
import { CATEGORY_MATCHER_VERSION } from './categories/categoryResolver.js';

interface CreateAppOptions {
  checkFirestore?: () => Promise<void>;
}

function readinessErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  if (code === 8 || code === '8' || code === 'RESOURCE_EXHAUSTED' || code === 'resource-exhausted'
    || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(message)) {
    return 'RESOURCE_EXHAUSTED';
  }
  return 'FIRESTORE_UNAVAILABLE';
}

export function createApp(options: CreateAppOptions = {}) {
  const checkFirestore = options.checkFirestore || (async () => {
    await adminDb.collection('users').limit(1).get();
  });
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const requestId = req.get('x-request-id')?.slice(0, 100) || randomUUID();
    const startedAt = performance.now();
    res.setHeader('x-request-id', requestId);
    res.once('finish', () => {
      console.log(JSON.stringify({
        level: 'info',
        event: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }));
    });
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'RateLimit', 'RateLimit-Policy'],
    maxAge: 3600,
  }));
  app.use(express.json({ limit: '512kb' }));
  app.get('/health', (_req, res) => res.json({
    status: 'ok',
    service: 'fastseo-users',
    revision: String(process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown').slice(0, 12),
    categoryMatcher: CATEGORY_MATCHER_VERSION,
    uptime: Math.floor(process.uptime()),
  }));
  app.get('/ready', asyncRoute(async (_req, res) => {
    try {
      await checkFirestore();
      res.json({ status: 'ready', service: 'fastseo-users', firestore: 'ok' });
    } catch (error) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'readiness_check_failed',
        dependency: 'firestore',
        errorCode: readinessErrorCode(error),
        requestId: res.getHeader('x-request-id') || null,
      }));
      res.status(503).json({ status: 'not_ready', firestore: 'unavailable' });
    }
  }));
  app.use('/api', apiRateLimiter, usersRouter, categoriesRouter, titleRulesRouter, usageRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const server = createApp().listen(config.port, config.host, () => {
    console.log(JSON.stringify({
      level: 'info',
      event: 'server_started',
      service: 'fastseo-users',
      environment: config.environment,
      host: config.host,
      port: config.port,
    }));
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(JSON.stringify({ level: 'info', event: 'server_stopping', signal }));
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    server.close(error => {
      clearTimeout(deadline);
      process.exit(error ? 1 : 0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
