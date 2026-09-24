import type { AddressInfo, Server } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index.js';

let server: Server | undefined;

afterEach(() => new Promise<void>((resolve, reject) => {
  vi.restoreAllMocks();
  if (!server) return resolve();
  server.close(error => error ? reject(error) : resolve());
  server = undefined;
}));

async function startApp(checkFirestore: () => Promise<void>) {
  const app = createApp({ checkFirestore });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

describe('health checks', () => {
  it('inicializa a aplicação e responde /health sem consultar o Firestore', async () => {
    const checkFirestore = vi.fn(async () => undefined);
    const baseUrl = await startApp(checkFirestore);

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      service: 'fastseo-users',
      categoryMatcher: 'title-identity-v2',
      revision: expect.any(String),
    });
    expect(checkFirestore).not.toHaveBeenCalled();
  });

  it('responde 503 quando o Firestore está indisponível durante /ready', async () => {
    const baseUrl = await startApp(async () => {
      throw new Error('Firestore unavailable');
    });

    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'not_ready', firestore: 'unavailable' });
  });

  it('trata RESOURCE_EXHAUSTED sem encaminhar a falha ao error handler genérico', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unhandled = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const quotaError = Object.assign(new Error('8 RESOURCE_EXHAUSTED: Quota exceeded'), { code: 8 });
    const baseUrl = await startApp(async () => {
      throw quotaError;
    });

    const response = await fetch(`${baseUrl}/ready`);

    expect(response.status).toBe(503);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('"errorCode":"RESOURCE_EXHAUSTED"'));
    expect(unhandled).not.toHaveBeenCalled();
  });
});
