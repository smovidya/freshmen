import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import { renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Wraps the stock @sveltejs/adapter-cloudflare output so this Worker can also
// serve the Hono app (mounted at /api, /dev-login, /__hono - see
// src/worker/app.ts) and export the Workflow class the Worker's Workflow
// binding depends on - neither of which adapter-cloudflare has a mechanism
// for. The SvelteKit-only worker it generates is kept, just renamed and used
// as the fallback handler for everything the Hono app doesn't claim.
const WORKER_DEST = path.resolve('.cloudflare/worker.js');
const SVELTEKIT_DEST = path.resolve('.cloudflare/worker.sveltekit.js');

export default function (options = {}) {
	const base = cloudflareAdapter(options);

	return {
		name: 'vidyafreshmen-cloudflare',
		async adapt(builder) {
			await base.adapt(builder);

			renameSync(WORKER_DEST, SVELTEKIT_DEST);

			writeFileSync(
				WORKER_DEST,
				`import sveltekit from './worker.sveltekit.js';
import { app } from '../src/worker/app.ts';

const API_PREFIXES = ['/api/', '/dev-login', '/__hono/'];

export default {
	async fetch(request, env, ctx) {
		const { pathname } = new URL(request.url);
		if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
			return app.fetch(request, env, ctx);
		}
		return sveltekit.fetch(request, env, ctx);
	},
};

export { syncGoogleSheetWithDatabase } from '../src/worker/workflows/googlesheet-sync-with-database.ts';
`
			);
		},
		emulate: base.emulate,
		supports: base.supports
	};
}
