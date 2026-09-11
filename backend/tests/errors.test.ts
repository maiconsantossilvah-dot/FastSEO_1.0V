import express from 'express';
import type { AddressInfo, Server } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/errors.js';

let server: Server | undefined;

afterEach(() => new Promise<void>((resolve, reject) => {
  vi.restoreAllMocks();
  if (!server) return resolve();
  server.close(error => error ? reject(error) : resolve());
  server = undefined;
}));

async function serveError(error: Error & { code?: number | string }) {
  const app = express();
  app.get('/failure', (_req, _res, next) => next(error));
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/failure`);
}

describe('tratamento de dependências', () => {
  it('expõe quota esgotada como indisponibilidade temporária reconhecível pelo frontend', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded'), { code: 8 });

    const response = await serveError(error);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'FIRESTORE_QUOTA_EXHAUSTED',
        message: expect.stringContaining('quota diária do Firestore'),
      },
    });
  });
});
