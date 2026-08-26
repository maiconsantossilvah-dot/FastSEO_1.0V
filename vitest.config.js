import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A primeira bateria cobre regras puras e roda sem navegador simulado.
    // Componentes DOM podem optar por happy-dom/jsdom arquivo a arquivo no futuro.
    environment: 'node',
    include: ['tests/frontend/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage/frontend',
      // A cobertura representa todo o frontend. Arquivos ainda não testados
      // aparecem como 0%, evitando uma porcentagem artificialmente alta.
      include: ['src/**/*.js'],
    },
  },
});
