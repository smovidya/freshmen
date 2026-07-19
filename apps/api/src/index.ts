import { createAuth } from '@vidyafreshmen/auth';
import { createDatabaseConnection } from '@vidyafreshmen/db';
import { FeatureFlags } from '@vidyafreshmen/flags';
import { apiRouter, type Variables as ApiVariables } from '@vidyafreshmen/server';
import { env, WorkerEntrypoint } from 'cloudflare:workers';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as jose from 'jose';
import { devLoginRouter } from './dev-login';
import { gameRouter } from './game';
import { getPopByGroups } from './game/coordinator';

const app = new Hono<{
	Variables: ApiVariables & {
		gameJWTPayload: jose.JWTPayload | null;
	};
}>();

app.use(
	'*', // or replace with "*" to enable cors for all routes
	cors({
		origin: [env.FRONTEND_URL || 'http://localhost:5173', env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000'],
		allowHeaders: ['Content-Type', 'Authorization'],
		allowMethods: ['POST', 'GET', 'OPTIONS'],
		exposeHeaders: ['Content-Length'],
		maxAge: 600,
		credentials: true,
	}),
);

app.get('/game', (c) => {
	return c.redirect(`${env.FRONTEND_URL || 'http://localhost:5173'}${c.req.path}`, 302);
});

app.route("/game", gameRouter);

app.route('/dev-login', devLoginRouter);

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
	const auth = createAuth({
		env,
	});
	return auth.handler(c.req.raw);
});

app.use('*', async (c, next) => {
	c.set('db', createDatabaseConnection(env.DB));
	c.set('flags', new FeatureFlags({ enabledAll: env.WORKER_ENV !== 'production' }));

	const auth = createAuth({
		env,
	});

	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		c.set('user', null);
		c.set('session', null);
		return next();
	}

	c.set('user', session.user);
	c.set('session', session.session);
	return next();
});

app.route('/api', apiRouter);


app.get("__hono/__version", c => {
	return c.json({
		version: 0x9065
	});
});


// app.get("/game-stats", async c => {
// 	const cfCaches = caches as unknown as WorkerCacheStorage;
// 	const cached = await cfCaches.default.match(c.req.raw);
// 	if (cached) {
// 		// console.log(`Cache hit for ${c.req.url}`);
// 		return cached;
// 	}

// 	// we dont rate limit this because cf cache

// 	const pops = await dumpStats();
// 	const response = Response.json(pops, {
// 		headers: {
// 			'Cache-Control': `max-age=${15}`,
// 		},
// 	});

// 	c.executionCtx.waitUntil(cfCaches.default.put(new Request(c.req.raw.url, c.req.raw), response.clone()));
// 	return response;
// });

// redirect all other requests to the frontend URL
app.all('*', (c) => {
	return c.redirect(`${env.FRONTEND_URL || 'http://localhost:5173'}${c.req.path}`, 302);
});

export default class ApiWorker extends WorkerEntrypoint {
	async fetch(request: Request): Promise<Response> {
		return app.fetch(request, {}, this.ctx);
	}

	async scheduled(event: ScheduledEvent): Promise<void> {
		// await env.SyncGoogleSheetWithDatabase.create()

		// can we fetch itself, to use cf cache
		const pops = await getPopByGroups();
		await env.GAME_STATS_DB
			.prepare("INSERT INTO stats (timestamp, stats) VALUES (?, ?)")
			.bind(Date.now(), JSON.stringify(pops))
			.run();
	}
}

// export all workflows
export { GameRegionHandler } from "./game/region-handler";
export * from './workflows';

