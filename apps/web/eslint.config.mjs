import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
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