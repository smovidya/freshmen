import cloudflareAdapter from '@sveltejs/adapter-cloudflare';
import { appendFileSync } from 'node:fs';
import path from 'node:path';

// adapter-cloudflare does not currently expose a way to add named exports to
// its generated Worker. Append only the Workflow export required by Wrangler;
// HTTP routing remains entirely inside SvelteKit.
const WORKER_DEST = path.resolve('.cloudflare/worker.js');

export default function (options = {}) {
	const base = cloudflareAdapter(options);

	return {
		name: 'vidyafreshmen-cloudflare',
		async adapt(builder) {
			await base.adapt(builder);

			appendFileSync(
				WORKER_DEST,
				`\nexport { syncGoogleSheetWithDatabase } from '../src/worker/workflows/googlesheet-sync-with-database.ts';\n`
			);
		},
		emulate: base.emulate,
		supports: base.supports
	};
}
