import { createAuth } from '@vidyafreshmen/auth';
import { makeSignature } from 'better-auth/crypto';
import type { RequestHandler } from './$types';

// Dev-only: mint a real Better Auth session for any student OUID without
// going through Google SSO. This uses the same user hook as a real signup.
export const GET: RequestHandler = async ({ cookies, platform, url }) => {
	if (!platform || platform.env.WORKER_ENV === 'production') {
		return new Response('Not Found', { status: 404 });
	}

	const ouid = url.searchParams.get('ouid') ?? '6912345623';
	const redirectTo =
		url.searchParams.get('redirectTo') || platform.env.FRONTEND_URL || 'http://localhost:5173';

	if (!/^\d{10}$/.test(ouid)) {
		return new Response('invalid ouid: must be 10 digits', { status: 400 });
	}

	const email = `${ouid}@student.chula.ac.th`;

	try {
		const auth = createAuth({ env: platform.env });
		const ctx = await auth.$context;

		// Better Auth's public internal-adapter types omit these runtime arguments.
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
					error: (code, body) => new Error(`${code}: ${body?.message ?? ''}`)
				}
			));

		const session = await internalAdapter.createSession(user.id, {});
		const signature = await makeSignature(session.token, ctx.secret);
		const attributes = ctx.authCookies.sessionToken.attributes;
		const sameSite = attributes.sameSite?.toLowerCase() as 'lax' | 'none' | 'strict' | undefined;

		cookies.set(ctx.authCookies.sessionToken.name, `${session.token}.${signature}`, {
			...attributes,
			path: attributes.path ?? '/',
			sameSite
		});

		return new Response(null, {
			status: 303,
			headers: { location: redirectTo }
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return new Response(`dev-login failed: ${message}`, { status: 400 });
	}
};
