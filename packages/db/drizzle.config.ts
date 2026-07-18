import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` only diffs ./schemas against ./drizzle and never touches
// the remote DB, so these are only required for `db:studio` (remote inspection).
// Local dev/CI apply migrations via `wrangler d1 migrations apply`, not drizzle-kit push.
export default defineConfig({
	schema: './schemas/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
		token: process.env.CLOUDFLARE_D1_TOKEN!,
	},
	verbose: true,
	strict: true,
});
