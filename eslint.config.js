import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }],
    },
  },
  {
    // The engine must stay runnable outside a browser, so it may not touch the DOM.
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/game must not reference the DOM. See SPEC.md Section 8.' },
        {
          name: 'document',
          message: 'src/game must not reference the DOM. See SPEC.md Section 8.',
        },
        {
          name: 'navigator',
          message: 'src/game must not reference the DOM. See SPEC.md Section 8.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seedable Rng. See SPEC.md Section 8.',
        },
      ],
    },
  },
);
