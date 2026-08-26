import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // As regras dependem do Firestore Emulator iniciado pelo script test:rules.
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
  },
});
