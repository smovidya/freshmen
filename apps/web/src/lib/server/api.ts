import { createAuth } from '@vidyafreshmen/auth';
import { createDatabaseConnection } from '@vidyafreshmen/db';
import { FeatureFlags } from '@vidyafreshmen/flags';
import { apiRouter, type Variables as ApiVariables } from '@vidyafreshmen/server';
import { Hono } from 'hono';

export const apiApp = new Hono<{
	Bindings: Env;
	Variables: ApiVariables;
}>();

apiApp.on(['POST', 'GET'], '/api/auth/*', (c) => {
	return createAuth({ env: c.env }).handler(c.req.raw);
});

apiApp.use('/api/*', async (c, next) => {
	c.set('db', createDatabaseConnection(c.env.DB));
	c.set('flags', new FeatureFlags({ enabledAll: c.env.WORKER_ENV !== 'production' }));
	c.set('isProduction', c.env.WORKER_ENV === 'production');
	c.set('turnstileSecret', c.env.TURNSTILE_SECRET);

	const auth = createAuth({ env: c.env });
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	c.set('user', session?.user ?? null);
	c.set('session', session?.session ?? null);

	await next();
});

apiApp.route('/api', apiRouter);
