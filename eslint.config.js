import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['coverage/**', 'backend/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'vitest.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
