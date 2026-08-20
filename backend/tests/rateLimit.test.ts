import express from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiRateLimiter } from '../src/rateLimit.js';

let server: Server | undefined;

afterEach(() => new Promise<void>((resolve, reject) => {
  if (!server) return resolve();
  server.close(error => error ? reject(error) : resolve());
  server = undefined;
}));

describe('API rate limiter', () => {
  it('bloqueia o IP após atingir o limite e envia cabeçalhos padrão', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(createApiRateLimiter({ windowMs: 60_000, limit: 2 }));
    app.get('/api', (_req, res) => res.json({ ok: true }));

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');
    const url = `http://127.0.0.1:${address.port}/api`;

    expect((await fetch(url)).status).toBe(200);
    expect((await fetch(url)).status).toBe(200);

    const blocked = await fetch(url);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('ratelimit')).toBeTruthy();
    expect(await blocked.json()).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas solicitações em pouco tempo. Aguarde e tente novamente.',
      },
    });
  });
});
