import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: [
      'test-results/**',
      'playwright-report/**',
      '.next/**',
      'dist/**',
      'coverage/**',
      'next-env.d.ts',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
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
  },
];
