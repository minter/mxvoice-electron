import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
        window: 'readonly',
        document: 'readonly',
        $: 'readonly',
        jQuery: 'readonly',
        electron: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'no-debugger': 'warn',
      'no-undef': 'error',
      'no-empty': 'warn',
      'no-cond-assign': 'warn',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-prototype-builtins': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/**',
      'tests/**',
      '*.log',
      'yarn.lock',
    ],
  },
  {
    files: ['**/*.cjs', '**/launcher.js'],
    rules: {
      'no-console': 'off',
    },
  },
];

