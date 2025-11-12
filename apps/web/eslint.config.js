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
          paths: ['.'],
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
    },
    rules: {
      // Temporarily disable import/no-unresolved for @/ paths since TypeScript handles these
      'import/no-unresolved': [
        'error',
        {
          ignore: [
            '^@/',
            '@simple-bookkeeping/database', // Type-only module (declaration file)
          ],
        },
      ],
      // Prevent Prisma imports - migration to Supabase complete (Issue #557)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Prisma is deprecated. Use Supabase Client instead (@/lib/supabase/server or @/lib/supabase/client).',
            },
            {
              name: 'prisma',
              message:
                'Prisma is deprecated. Use Supabase Client instead (@/lib/supabase/server or @/lib/supabase/client).',
            },
          ],
          patterns: [
            {
              group: ['**/prisma/**'],
              message:
                'Prisma imports are not allowed. Use Supabase Client instead (@/lib/supabase/server or @/lib/supabase/client).',
            },
          ],
        },
      ],
    },
  },
];
