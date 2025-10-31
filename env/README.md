# Environment Configuration

This repository relies on [direnv](https://direnv.net/) to export environment variables into every shell that touches the project.  
The goal is to keep secrets outside of version control while still documenting which values are expected.

## Directory layout

- `env/templates/` — example files committed to git. Copy these to `env/secrets/` (or another ignored location) and fill in real values.
- `env/secrets/` — developer-specific copies of the templates. This directory is ignored by git; create it locally.
- `.env.local` — auto-generated symlink (via `scripts/env-manager.sh`) pointing to the active Supabase profile under `env/secrets/`.
- `env/secrets/common.env` _(optional)_ — shared, non-secret defaults loaded for every profile.

## Typical setup

```bash
mkdir -p env/secrets
cp env/templates/common.env.example env/secrets/common.env
cp env/templates/supabase.local.env.example env/secrets/supabase.local.env
cp env/templates/supabase.prod.env.example env/secrets/supabase.prod.env
cp env/templates/vercel.env.example env/secrets/vercel.env
cp env/templates/ai.env.example env/secrets/ai.env  # optional

# もしくは1コマンドで初期化
scripts/env-manager.sh bootstrap
```

After editing those copies with real credentials:

```bash
# Activate local Supabase
scripts/env-manager.sh switch local

# Switch to production Supabase (careful!)
scripts/env-manager.sh switch prod
```

direnv automatically loads:

1. `env/secrets/common.env` (if present)
2. `.env.local` (symlink to the selected Supabase profile)
3. `env/secrets/vercel.env` (deployment metadata and API token)

Environment variables exported by direnv are available to the CLI and are also read by Next.js when you run `pnpm dev`.  
See `docs/ENVIRONMENT_VARIABLES.md` for a full walkthrough of the workflow.
