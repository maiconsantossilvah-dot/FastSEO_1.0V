import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { usersRouter } from './users/users.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.length === 0 || config.frontendOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origem não autorizada.'));
    },
  }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'fastseo-users' }));
  app.use('/api', usersRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  createApp().listen(config.port, () => {
    console.log(`FastSEO users backend ouvindo na porta ${config.port}.`);
  });
}
