import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// Standalone config for exposing an already-built worker via a Cloudflare quick tunnel.
// Kept separate from vite.config.ts — combining `cloudflare()` with `sveltekit()` in one
// config crashes `vite dev` (the plugin can't load `.cloudflare/worker.js` through
// SvelteKit's own module pipeline). Run via `bun run dev:tunnel` (builds first, then serves
// the built worker with a public tunnel).
export default defineConfig({
	plugins: [
		cloudflare({
			configPath: './wrangler.jsonc',
			tunnel: { autoStart: true }
		})
	]
});
