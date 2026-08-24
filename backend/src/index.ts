import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { AppError, errorHandler, notFoundHandler } from './errors.js';
import { apiRateLimiter } from './rateLimit.js';
import { usersRouter } from './users/users.routes.js';
import { categoriesRouter } from './categories/categories.routes.js';
import { usageRouter } from './usage/usage.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.'));
    },
  }));
  app.use(express.json({ limit: '512kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'fastseo-users' }));
  app.use('/api', apiRateLimiter, usersRouter, categoriesRouter, usageRouter);
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
