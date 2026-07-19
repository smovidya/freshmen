# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vidya Freshmen — festival/registration web app for Chulalongkorn Science freshmen (student.chula.ac.th SSO only). Bun/Turborepo monorepo, deployed as a single Cloudflare Worker.

## Commands

Package manager: bun (`bun@1.2.0`, workspaces: `apps/*`, `packages/*`, `scripts/*`).

```bash
bun install                    # install deps
bun run dev                    # turbo dev --parallel across all workspaces (SvelteKit dev server, http://localhost:5173)
cd apps/web && bun run dev:worker   # full stack against real Workers bindings (D1, Workflows)
bun run build                  # turbo build
bun run check-types            # turbo check-types (tsc --noEmit per package; svelte-check for web)
bun run lint                   # turbo lint (prettier --check + eslint, apps/web only)
bun turbo deploy               # deploy to Cloudflare Workers (maintainer only)
```

No test suite exists in this repo currently.

Database (D1 via drizzle), run from repo root or `packages/db`:
```bash
bun turbo db:push              # push schema changes (mentioned in README as the quick path)
bun run db:generate            # drizzle-kit generate — create a new migration from schema changes
bun run db:migrate:local       # apply migrations to local D1
bun run db:migrate:remote      # apply migrations to remote D1
bun run db:studio              # drizzle-kit studio
```
DB commands under `apps/web` and `packages/db` both proxy to the same D1 database (`--config ../../apps/web/wrangler.jsonc`), so they're interchangeable.

Environment setup (see README for full detail): copy `apps/web/example.dev.vars` → `apps/web/.dev.vars` (needs `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), and `apps/web/.env.example` → `apps/web/.env`.

## Architecture

Single Cloudflare Worker serves both the SvelteKit frontend and a Hono API mounted under `/api/*`. `packages/typescript-config` is broken/unused per README — don't rely on it.

**Request flow**: `apps/web/src/routes/api/[...path]/+server.ts` hands every method to `apiApp.fetch(request, platform.env, platform.ctx)`. `apiApp` (`apps/web/src/lib/server/api.ts`) is where Cloudflare bindings (`Env`, D1, secrets) actually get touched — it builds `db`, `flags`, and `user`/`session` (via `better-auth`) once per request and sets them on Hono context, then delegates to `apiRouter` from `@vidyafreshmen/server` for everything under `/api`. `@vidyafreshmen/auth` and `@vidyafreshmen/db` deliberately avoid importing `cloudflare:workers` directly — bindings are threaded down through context instead, so shared packages stay Env-agnostic.

**`packages/server`** is the actual API: `router.ts` composes per-domain routers (`routers/team.ts`, `routers/user.ts`) and centralizes error handling — service functions throw plain `Error`s for business-logic failures, and `router.ts`'s `onError` converts them to `{error: message}` JSON (a trpc-like convention, not real trpc). Business logic lives in `services/*.service.ts` (team, group, game, students), consumed by routers. `core.ts` defines the shared Hono `Variables` type (`user`, `session`, `db`, `flags`) and a `requireUser` middleware gate.

**`packages/db`**: Drizzle ORM over D1. `schemas/schema.ts` re-exports `auth.schema.ts` (better-auth tables) and `student.schema.ts` (app tables). Migrations live in `packages/db/drizzle/`; both `apps/web` and `packages/db` migration scripts point at the same D1 binding via `apps/web/wrangler.jsonc`.

**`packages/auth`**: wraps `better-auth` with Google OAuth restricted to `@student.chula.ac.th` (`hd` domain restriction + a `databaseHooks.user.create.before` check that derives `ouid` from the email and rejects non-student emails). JWT plugin enabled; cookie prefix `vidyafreshmen`.

**`packages/flags`** (`FeatureFlags` class): the *only* place festival features are date-gated. `config.ts` defines named windows (`registering`, `team-joining`, `group-choosing`, `group-announcement`, `game-playing`, all Asia/Bangkok `+07:00`) as one of `EventTimeWindow | ScheduledEvent | AlwaysAvailable | EventWithDeadline | CustomSwitch`. Everything else must read gating through `flags.isEnabled('feature-name')`, not by hardcoding dates. In non-production (`WORKER_ENV !== 'production'`), `apiApp` constructs `FeatureFlags` with `enabledAll: true`, bypassing all windows.

**`packages/dto`**: shared Zod schemas (`dto/group.ts`, `dto/registration.ts`) used across web forms and server validation — keep request/response shapes here rather than duplicating.

**`apps/web/src/lib/dev/`**: dev-only floating toolbar (`DevToolbar.svelte`) + `flag-overrides.ts` to force feature flags on/off and mock-login as a test student (`/dev-login` route) without Google SSO — only relevant/active outside production.

**`apps/web/src/worker/workflows/`**: Cloudflare Workflow entrypoints (e.g. `googlesheet-sync-with-database.ts`), kept separate from the SvelteKit route tree. Currently commented out in `wrangler.jsonc`'s `workflows` block — check there before assuming a workflow is live.

**Route groups**: `apps/web/src/routes/(content)/` holds the main festival pages (`register`, `group`, `group-result`, `menu`); `auth/`, `dev-login/`, `game/`, `api/` are top-level.

## Festival schedule

See README's "Festival schedule" table for current window values — it's the source of truth for `packages/flags/config.ts` at time of writing; check the file directly if the table might be stale.
