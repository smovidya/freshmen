import { createAuthClient } from 'better-auth/svelte';
import { genericOAuthClient, inferAdditionalFields, jwtClient } from 'better-auth/client/plugins';
import { env } from '$env/dynamic/public';
import type { auth } from '@vidyafreshmen/auth';

export const authClient = createAuthClient({
	baseURL: env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:8787',
	plugins: [
		genericOAuthClient(),
		inferAdditionalFields<typeof auth>(),
		jwtClient()
	],
});
