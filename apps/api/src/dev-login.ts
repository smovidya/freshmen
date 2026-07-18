import { auth } from '@vidyafreshmen/auth';
import { makeSignature } from 'better-auth/crypto';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';

// Dev-only: mint a real better-auth session for any 68xx...23 student OUID
// without going through Google SSO. Mirrors the app's own signup hook
// (packages/auth/index.ts) instead of bypassing it, so the resulting user
// row looks exactly like a real signup.
export const devLoginRouter = new Hono();

devLoginRouter.get('/', async (c) => {
	if (env.WORKER_ENV === 'production') {
		return c.notFound();
	}

	const ouid = c.req.query('ouid') ?? '6812345623';
	const redirectTo = c.req.query('redirectTo') || env.FRONTEND_URL || 'http://localhost:5173';

	if (!/^\d{10}$/.test(ouid) || !ouid.endsWith('23')) {
		return c.text('invalid ouid: must be 10 digits ending in "23" (science freshmen)', 400);
	}

	const email = `${ouid}@student.chula.ac.th`;

	try {
		const ctx = await auth.$context;

		// internalAdapter's public types only cover the simple, documented call
		// shape - createUser's second (hook context) and createSession's second
		// (request context) params exist on the actual runtime implementation
		// but aren't part of the exported types. Cast narrowly rather than typing
		// this whole internal, undocumented surface.
		const internalAdapter = ctx.internalAdapter as unknown as {
			findUserByEmail: (email: string) => Promise<{ user: { id: string } } | null>;
			createUser: (
				user: { email: string; name: string; emailVerified: boolean },
				context: { error: (code: string, body?: { message?: string }) => Error }
			) => Promise<{ id: string }>;
			createSession: (userId: string, context: object) => Promise<{ token: string }>;
		};

		const existing = await internalAdapter.findUserByEmail(email);
		const user =
			existing?.user ??
			(await internalAdapter.createUser(
				{ email, name: 'Dev User', emailVerified: true },
				{
					// The app's databaseHooks.user.create.before hook still runs through
					// this path and calls context.error(...) on rejection (e.g. ouid not
					// ending in "23") - it expects this shape.
					error: (code, body) => new Error(`${code}: ${body?.message ?? ''}`)
				}
			));

		const session = await internalAdapter.createSession(user.id, {});

		const signature = await makeSignature(session.token, ctx.secret);
		const signedToken = `${session.token}.${signature}`;

		setCookie(c, ctx.authCookies.sessionToken.name, signedToken, ctx.authCookies.sessionToken.attributes);

		return c.redirect(redirectTo, 303);
	} catch (err) {
		return c.text(`dev-login failed: ${err instanceof Error ? err.message : String(err)}`, 400);
	}
});
