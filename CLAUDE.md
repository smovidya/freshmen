# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vidya Freshmen — festival/registration web app for Chulalongkorn Science freshmen (student.chula.ac.th SSO only). Bun/Turborepo monorepo, deployed as two Cloudflare Workers: `apps/web` (SvelteKit frontend + Hono API, the `vidyafreshmen` worker) and `apps/workers` (cron-only background jobs, the `vidyafreshmen-workers` worker), sharing one D1 database.

## Terminology (2026 CI)

This year's branding is airline-themed. In all **user-facing copy**, call a group ("กรุ๊ป") a **สายการบิน (Airline)**, and call a subgroup/boing a **โบอิ้ง (Boeing)** — e.g. boarding-pass.svelte's AIRLINE/BOEING fields. This is display terminology only: DB columns/schema (`result_group_number`, `student_group.group_number`/`subgroup_number`), TypeScript identifiers (`resultGroupNumber`, `subgroupNumber`, `groupData`, `boingCode`), and route/param names stay as `group`/`subgroup` — don't rename code to match.

## Commands

Package manager: bun (`bun@1.2.0`, workspaces: `apps/*`, `packages/*`, `scripts/*`).

```bash
bun install                    # install deps
bun run dev                    # turbo dev --parallel across all workspaces (SvelteKit dev server, http://localhost:5173)
cd apps/web && bun run dev:tunnel   # builds, then serves the built worker behind a public Cloudflare quick tunnel (URL printed on start)
cd apps/workers && bun run dev      # apps/workers wrangler dev (Google Sheets sync worker)
cd apps/workers && bun run cf-typegen  # regenerate worker-configuration.d.ts after wrangler.jsonc changes
bun run build                  # turbo build
bun run check-types            # turbo check-types (tsc --noEmit per package; svelte-check for web)
bun run lint                   # turbo lint (prettier --check + eslint, apps/web only)
bun turbo deploy               # deploy to Cloudflare Workers (maintainer only) — deploys apps/web and apps/workers separately
```

`apps/web`'s `check-types` (svelte-check) has pre-existing failures (thousands of errors from a svelte/sveltekit version mismatch inside `.svelte-kit/output` — not caused by app code) — don't assume a fresh svelte-check failure is yours; check whether it reproduces on a clean tree first. No test suite exists in this repo currently.

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

Plain `bun run dev` (`vite dev`, SvelteKit's own dev server) is the full stack now — no separate `wrangler dev` process (the old `dev:worker` script/turbo task is gone). For sharing a running instance externally, `cd apps/web && bun run dev:tunnel` builds the worker and serves it via `vite.tunnel.config.ts` (a separate Vite config using `@cloudflare/vite-plugin`'s `cloudflare()` plugin with `tunnel: { autoStart: true }`) — this is deliberately kept out of the main `vite.config.ts`: combining `cloudflare()` with SvelteKit's own `sveltekit()` plugin in one config crashes `vite dev` (the plugin can't resolve `.cloudflare/worker.js` through SvelteKit's module pipeline). `dev:tunnel` only serves a snapshot of the last build, not live-reloading source changes.

**Request flow**: `apps/web/src/routes/api/[...path]/+server.ts` hands every method to `apiApp.fetch(request, platform.env, platform.ctx)`. `apiApp` (`apps/web/src/lib/server/api.ts`) is where Cloudflare bindings (`Env`, D1, secrets) actually get touched — it builds `db`, `flags`, and `user`/`session` (via `better-auth`) once per request and sets them on Hono context, then delegates to `apiRouter` from `@vidyafreshmen/server` for everything under `/api`. `@vidyafreshmen/auth` and `@vidyafreshmen/db` deliberately avoid importing `cloudflare:workers` directly — bindings are threaded down through context instead, so shared packages stay Env-agnostic.

**`packages/server`** is the actual API: `router.ts` composes per-domain routers (`routers/team.ts`, `routers/user.ts`) and centralizes error handling — service functions throw plain `Error`s for business-logic failures, and `router.ts`'s `onError` converts them to `{error: message}` JSON (a trpc-like convention, not real trpc). Business logic lives in `services/*.service.ts` (team, group, game, students), consumed by routers. `core.ts` defines the shared Hono `Variables` type (`user`, `session`, `db`, `flags`) and a `requireUser` middleware gate.

**`packages/db`**: Drizzle ORM over D1. `schemas/schema.ts` re-exports all schema files — `auth.schema.ts` (better-auth tables), `student.schema.ts` (`students`, `teams`, `availableGroups`), `checkin.schema.ts` (`staffs`, `activities`, `checkpoints`, `staff_activities` join table, `scans`), `student-group.schema.ts` (`student_group` — standalone, no FKs), `sync.schema.ts` (`sync_state`, bookkeeping for `apps/workers`' sheet sync cursors). Convention across app tables: `id` is `text` uuid (`$defaultFn(() => crypto.randomUUID())`), `created_at`/`updated_at` timestamps on every table, `deleted_at` (soft delete) only on tables where it makes sense (`staffs`/`activities`/`checkpoints`, not `scans` or `sync_state`). Migrations live in `packages/db/drizzle/`; both `apps/web` and `packages/db` migration scripts point at the same D1 binding via `apps/web/wrangler.jsonc`. `apps/workers` uses the same D1 database, no separate migrations dir.

**`packages/auth`**: wraps `better-auth` with Google OAuth restricted to `@student.chula.ac.th` (`hd` domain restriction + a `databaseHooks.user.create.before` check that derives `ouid` from the email and rejects non-student emails). JWT plugin enabled; cookie prefix `vidyafreshmen`.

**`packages/flags`** (`FeatureFlags` class): the *only* place festival features are date-gated. `config.ts` defines named windows (`registering`, `team-joining`, `group-choosing`, `group-announcement`, `game-playing`, all Asia/Bangkok `+07:00`) as one of `EventTimeWindow | ScheduledEvent | AlwaysAvailable | EventWithDeadline | CustomSwitch`. Everything else must read gating through `flags.isEnabled('feature-name')`, not by hardcoding dates. In non-production (`WORKER_ENV !== 'production'`), `apiApp` constructs `FeatureFlags` with `enabledAll: true`, bypassing all windows.

**`packages/dto`**: shared Zod schemas (`dto/group.ts`, `dto/registration.ts`) used across web forms and server validation — keep request/response shapes here rather than duplicating.

**`apps/web/src/lib/dev/`**: dev-only floating toolbar (`DevToolbar.svelte`) + `flag-overrides.ts` to force feature flags on/off and mock-login as a test student (`/dev-login` route) without Google SSO — only relevant/active outside production.

**Route groups**: `apps/web/src/routes/(content)/` holds the main festival pages (`register`, `group`, `group-result`, `menu`); `auth/`, `dev-login/`, `game/`, `api/` are top-level.

**`apps/web/src/lib/components/tag-checklist.svelte`**: reusable checklist-with-"other" input (`Switch` to toggle "has any" + checkbox tags + free-text "other" field, all collapsed into one comma-joined `string` value). Used for every optional multi-value registration field (`medicalConditions`, `drugAllergies`, `foodAllergies`, `foodLimitations` in `register/+page@.svelte`) instead of a raw `Textarea` — prefer it over a textarea for any new checklist-shaped optional field.

**`apps/workers`** (`@vidyafreshmen/workers`): standalone Worker, no HTTP — cron-triggered background jobs syncing D1 → Google Sheets. See `apps/workers/CLAUDE.md` for the sync-table config, full/partial sync strategy, and the Google Sheets auth gotcha.

## Festival schedule

See README's "Festival schedule" table for current window values — it's the source of truth for `packages/flags/config.ts` at time of writing; check the file directly if the table might be stale.
