import { createAuth } from '@vidyafreshmen/auth';
import { createDatabaseConnection } from '@vidyafreshmen/db';
import { FeatureFlags } from '@vidyafreshmen/flags';
import { apiRouter, type Variables as ApiVariables, type SimpleCache } from '@vidyafreshmen/server';
import { Hono } from 'hono';

export const apiApp = new Hono<{
	Bindings: Env;
	Variables: ApiVariables;
}>();

apiApp.on(['POST', 'GET'], '/api/auth/*', (c) => {
	return createAuth({ env: c.env }).handler(c.req.raw);
});

// `caches` (the Workers Cache API global) only exists under a real Workers
// runtime (wrangler dev / deployed) - plain `bun run dev` is SvelteKit's own
// vite dev server (see project CLAUDE.md: no wrangler dev process for local
// dev), where `caches` is simply undefined and crashed every /api/* request.
// In-memory Map fallback there - fine for local dev, never used once
// deployed since `caches` is always defined in that case.
const devMemoryCache = new Map<string, { response: Response; expiresAt: number }>();
const devFallbackCache: SimpleCache = {
	async match(key) {
		const entry = devMemoryCache.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			devMemoryCache.delete(key);
			return undefined;
		}
		return entry.response.clone();
	},
	async put(key, response) {
		const maxAgeMatch = response.headers.get('Cache-Control')?.match(/max-age=(\d+)/);
		const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 5000;
		devMemoryCache.set(key, { response: response.clone(), expiresAt: Date.now() + ttlMs });
	}
};

function resolveCache(): SimpleCache {
	// `.default` is a Cloudflare-specific CacheStorage extension the ambient
	// DOM lib type doesn't know about - the runtime check is what actually
	// matters here, the cast just satisfies tsc.
	if (typeof caches === 'undefined') return devFallbackCache;
	return (caches as unknown as { default: SimpleCache }).default;
}

apiApp.use('/api/*', async (c, next) => {
	c.set('db', createDatabaseConnection(c.env.DB));
	c.set('flags', new FeatureFlags({ enabledAll: c.env.WORKER_ENV !== 'production' }));
	c.set('cache', resolveCache());
	c.set('isProduction', c.env.WORKER_ENV === 'production');
	c.set('turnstileSecret', c.env.TURNSTILE_SECRET);

	const auth = createAuth({ env: c.env });
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	c.set('user', session?.user ?? null);
	c.set('session', session?.session ?? null);

	await next();
});

apiApp.route('/api', apiRouter);
