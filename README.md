# Trademark Engine

Standalone **test-driven** multilingual trademark retrieval, comparison, and experimental conflict-scoring engine.

Scans the **already filled local engine corpus** via PostgreSQL indexes. No live registry API. No AI. No fixture-demo as a normal scan.

## Quick start

```bash
cp .env.example .env   # set DATABASE_URL + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
pnpm install
# Local Postgres 16 (Homebrew) on :5432, or:
docker compose up -d postgres   # :5433
# createdb trademark_engine     # once, if using Homebrew Postgres
pnpm db:migrate
pnpm corpus:purge-statuses      # keep only REGISTERED + ACCEPTED locally
pnpm corpus:bridge              # CORPUS_LIMIT=0 → full filter-1 allowlist
pnpm corpus:preprocess          # fill normalized + phonetic keys (required)
pnpm build                       # compile workspace packages (also runs via turbo before `pnpm dev`)
pnpm dev                        # API :3000 + dashboard :5173
```

Or separately: `pnpm dev:api` and `pnpm dev:dashboard`.

### Corpus scope

- **Filter 1:** only `REGISTERED` + `ACCEPTED` from `test_database_europa` (read-only).
- **Full sync:** `CORPUS_LIMIT=0` (default in `.env.example`).
- **Proof subset:** `CORPUS_LIMIT=100000 pnpm corpus:bridge`.

Source table is **read-only** — never upsert/update/delete. Indexes and preprocess live only in engine tables.

## Architecture

See [docs/architecture/overview.md](docs/architecture/overview.md).

## Corpus

Bridge from `test_database_europa` → engine schema: [docs/database/corpus-bridge.md](docs/database/corpus-bridge.md).

EUIPO sandbox limits / discovery (legacy fill only): [docs/runbooks/euipo-sandbox-discovery.md](docs/runbooks/euipo-sandbox-discovery.md).

## Legacy

Previous experimental EUIPO/scrape code lives under `legacy/` and is **not** part of the engine architecture.
