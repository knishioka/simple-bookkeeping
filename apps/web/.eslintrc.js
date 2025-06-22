module.exports = {
  extends: ['../../.eslintrc.js'],
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json',
        alwaysTryTypes: true,
      },
      node: {
        paths: ['src'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // Temporarily disable import/no-unresolved for @/ paths since TypeScript handles these
    'import/no-unresolved': [
      'error',
      {
        ignore: ['^@/'],
      },
    ],
  },
  overrides: [
    {
      files: ['e2e/**/*.ts', 'e2e/**/*.spec.ts'],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
      },
    },
    {
      files: ['jest.setup.js', 'playwright.config.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
