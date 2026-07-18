# vidyafreshmen
![vidyafreshmen](./apps/web/src/lib/assets/elements/18.png)


A monorepo for the vidyafreshmen project that includes various components and services.

## Project Structure
- `apps/`: Contains the main applications.
  - `api/`: The backend API service. Handle Authentication and tRPC Handlers written in TypeScript.
  - `web/`: The frontend web application. Built with SvelteKit
- `packages/`: Contains shared libraries and utilities.
  - `auth/`: BetterAuth configuration for authentication.
  - `trpc/`: tRPC handlers and utilities.
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
- `apps/api/example.dev.vars` rename to `.dev.vars` and fill in the required values. (You mosly need to set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth)
- `apps/web/.env.example` rename to `.env` (no need to fill in anything, just rename it).

For sake of simplicity, run the following command to rename the files:

```bash
mv apps/api/example.dev.vars apps/api/.dev.vars && mv apps/web/.env.example apps/web/.env
```

Push database schema changes:

```bash
bun turbo db:push
```

Then start the development server:

```bash
bun run dev
```

Navigate to `http://localhost:5173` to see the web application and `http://localhost:8787` for the API.

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