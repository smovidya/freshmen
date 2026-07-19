# vidyafreshmen
![vidyafreshmen](./apps/web/src/lib/assets/elements/18.png)


A monorepo for the vidyafreshmen project that includes various components and services.

## Project Structure
- `apps/`: Contains the main applications.
  - `web/`: The SvelteKit frontend and server routes, including the Hono API, deployed together as one Cloudflare Worker. Workflow entrypoints remain under `apps/web/src/worker/workflows/`.
- `packages/`: Contains shared libraries and utilities.
  - `auth/`: BetterAuth configuration for authentication.
  - `server/`: Hono routers and business-logic services shared by the API.
  - `db/`: Database utilities and migrations.
  - `typescript-config/`: Shared TypeScript configuration (seem to be broken).
- `turbo.json`: Configuration for Turborepo to manage tasks and dependencies across the monorepo.

## Development

We use bun as the package manager and task runner. To get started, install bun if you haven't already:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then, install the dependencies:

```bash
bun install
```

Setting up environment variables:
- `apps/web/example.dev.vars` rename to `.dev.vars` and fill in the required values. (You mosly need to set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth)
- `apps/web/.env.example` rename to `.env` (no need to fill in anything, just rename it).

For sake of simplicity, run the following command to rename the files:

```bash
mv apps/web/example.dev.vars apps/web/.dev.vars && mv apps/web/.env.example apps/web/.env
```

Push database schema changes:

```bash
bun turbo db:push
```

Then start the development server:

```bash
bun run dev
```

Navigate to `http://localhost:5173` for SvelteKit page, API, and auth development. The Cloudflare adapter provides local platform bindings to the SvelteKit server routes.

To run the full stack (pages + Hono API + Workflows) against real Workers bindings, use:

```bash
cd apps/web && bun run dev:worker
```

and navigate to `http://localhost:5173`.

## Festival schedule

Time-gated features are controlled by `packages/flags/config.ts` (all times Asia/Bangkok, +07:00). This is the only place feature availability is date-gated — everything else reads through `FeatureFlags.isEnabled(...)`.

| Flag | Window |
| --- | --- |
| `registering` | 2026-07-19 18:00 → 2026-07-21 23:59 |
| `team-joining` | 2026-07-19 18:00 → 2026-07-21 23:59 |
| `group-choosing` (group preference ordering) | 2026-07-19 18:00 → 2026-07-21 23:59 |
| `group-announcement` | opens 2026-07-23 18:00 (no end) |
| `game-playing` (d-day) | 2026-07-25 00:00 → 2026-07-27 23:59 |

In dev, use the floating dev toolbar (bottom of the screen, dev-only) to force any of these flags on/off regardless of the actual date/time, and to mock-login as a test student without going through Google SSO.

## Deployment

For deployment, we use Cloudflare Workers for both the API and web applications. If you are the maintainer, you can deploy using the following commands:
```bash
bun turbo deploy
```

### Build configuration

I took too long to come up with these value so put here for future reference.

```
Build configuration
Build command:
    bun turbo build -- --filter api
Deploy command:
    bun run deploy
Version command:
    bunx wrangler versions upload
Root directory:
    /
```
