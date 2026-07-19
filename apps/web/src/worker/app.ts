import { createAuth } from '@vidyafreshmen/auth';
import { createDatabaseConnection } from '@vidyafreshmen/db';
import { FeatureFlags } from '@vidyafreshmen/flags';
import { apiRouter, type Variables as ApiVariables } from '@vidyafreshmen/server';
import { Hono } from 'hono';
import { devLoginRouter } from './dev-login';

export const app = new Hono<{
	Bindings: Env;
	Variables: ApiVariables;
}>();

app.on(['POST', 'GET'], '/api/auth/*', (c) => {
	const auth = createAuth({ env: c.env });
	return auth.handler(c.req.raw);
});

app.use('/api/*', async (c, next) => {
	c.set('db', createDatabaseConnection(c.env.DB));
	c.set('flags', new FeatureFlags({ enabledAll: c.env.WORKER_ENV !== 'production' }));

	const auth = createAuth({ env: c.env });
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

app.route('/dev-login', devLoginRouter);

app.get('/__hono/__version', (c) => {
	return c.json({ version: 0x9065 });
});

export * from './workflows';
