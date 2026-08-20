import { describe, expect, it } from 'vitest';
import { normalizePrivateKey } from '../src/credentials.js';

const pem = '-----BEGIN PRIVATE KEY-----\nconteudo-de-teste\n-----END PRIVATE KEY-----';

describe('normalizePrivateKey', () => {
  it('preserva um PEM com múltiplas linhas', () => {
    expect(normalizePrivateKey(pem)).toBe(pem);
  });

  it('converte quebras escapadas copiadas do JSON', () => {
    expect(normalizePrivateKey(pem.replace(/\n/g, '\\n'))).toBe(pem);
  });

  it('remove aspas externas de um valor JSON', () => {
    expect(normalizePrivateKey(JSON.stringify(`${pem}\n`))).toBe(pem);
  });

  it('trata valores vazios como ausentes', () => {
    expect(normalizePrivateKey('   ')).toBeUndefined();
  });
});
