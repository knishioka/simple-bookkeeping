# Repository Guidelines

## Project Structure & Module Organization

- `apps/web` – Next.js App Router; logic in `app/`, utilities in `lib/`, Jest specs in `__tests__`, Playwright suites in `e2e/`.
- `packages/database` – Prisma schema and migrations shared across services; run `pnpm db:migrate` after edits.
- `packages/shared`, `packages/errors`, `packages/typescript-config` – shared helpers, error mappers, and base TS configs served via workspace aliases.
- `supabase/` – SQL migrations and edge functions backing local Supabase; keep files ordered and reversible.
- `docs/` and `scripts/` – long-form guidance and automation entrypoints; extend existing patterns rather than duplicating tooling.

## Environment & Secrets Management

- Direnv loads variables from `env/secrets/common.env` → `.env.local` (symlink) → `env/secrets/vercel.env` → optional `env/secrets/ai.env`; the workflow is documented in `env/README.md` and `docs/ENVIRONMENT_VARIABLES.md`.
- Use `scripts/env-manager.sh bootstrap` to copy templates into `env/secrets/`, then `scripts/env-manager.sh switch <profile>` to activate (`local` or `prod`). See `docs/direnv-setup.md` for the direnv hook details.
- Real Supabase keys live in `env/secrets/supabase.*.env`; verify the active profile with `scripts/env-manager.sh current` before running migrations or CLI work.
- Vercel metadata and tokens belong in `env/secrets/vercel.env`; temporarily export them for CLI actions with `set -a; source env/secrets/vercel.env; set +a`.
- Avoid creating ad-hoc `.env.*` files; update the appropriate `env/secrets/*.env` file and reload direnv (`direnv reload`) when values change.

## Build, Test, and Development Commands

- `pnpm install` – sync workspace dependencies whenever lockfiles or packages shift.
- `pnpm supabase:start` (or `pnpm supabase:docker`) – launch local Supabase services used by auth, DB, and realtime flows.
- `pnpm dev` – Turbo-powered dev servers with watch rebuilds for touched workspaces.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` – enforce ESLint, TypeScript, and Prettier before committing.
- `pnpm test`, `pnpm test:e2e`, `pnpm test:coverage` – execute Jest suites, Playwright flows, and coverage reporting.
- `pnpm build` / `pnpm build:web` – produce production bundles; run prior to release merges or deployment checks.

## Coding Style & Naming Conventions

- TypeScript-first; reuse shared types via `@simple-bookkeeping/types` and keep DTOs centralized.
- Prettier enforces 2-space indentation, single quotes, trailing commas, and LF endings; use `pnpm format`.
- ESLint blocks `any`, requires grouped imports, React hooks rules, accessibility, and security linting; resolve instead of disabling.
- Branches follow `feature/`, `fix/`, `docs/`, `test/`, or `refactor/` prefixes with kebab-case slugs.

## Testing Guidelines

- Component tests live in `apps/web/__tests__` with Jest and React Testing Library (`*.spec.tsx`).
- Package logic tests sit beside source in `__tests__` or `*.spec.ts`; keep fixtures typed and minimal.
- Playwright flows reside in `apps/web/e2e`; reuse page objects, fixtures, and helpers to stay consistent.
- New work ships with matching tests, and `pnpm test`, `pnpm test:e2e`, `pnpm test:coverage` must pass before review.

## Commit & Pull Request Guidelines

- Use `<type>: <imperative subject>` commits (e.g., `feat: add cash ledger exports`) and add bullet bodies for context when needed.
- Link issues with `Closes #123` / `Relates to #123` so automation tracks the change.
- PRs require an overview, checked tasks, test evidence, and UI screenshots when relevant; call out Supabase schema updates explicitly.
- Run lint, typecheck, and relevant tests pre-push and summarize noteworthy output in the PR description.
