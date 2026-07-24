import { createAuthClient } from 'better-auth/svelte';
import {
	adminClient,
	genericOAuthClient,
	inferAdditionalFields,
	jwtClient
} from 'better-auth/client/plugins';
import { env } from '$env/dynamic/public';
import { authRoles, type createAuth } from '@vidyafreshmen/auth';

export const authClient = createAuthClient({
	baseURL: env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:5173',
	plugins: [
		genericOAuthClient(),
		inferAdditionalFields<ReturnType<typeof createAuth>>(),
		jwtClient(),
		adminClient({ roles: authRoles })
	]
});
