import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  {
    // TypeScript sources, tests and tool configs: strict, type-aware rules.
    files: ['**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Tests: small inline helpers do not need explicit return types.
    files: ['tests/**/*.ts'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  {
    // Plain JavaScript (this config, Node scripts): not part of a TS project.
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  prettier,
);
