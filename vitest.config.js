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
      include: [
        'src/utils/html.js',
        'src/utils/sanitizeInput.js',
        'src/utils/prepareProductInput.js',
        'src/utils/matching.js',
        'src/modules/outputGuards.js',
        'src/modules/tokenUsage.js',
      ],
    },
  },
});
