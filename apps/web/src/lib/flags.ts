import { env } from '$env/dynamic/public';
import { FeatureFlags } from '@vidyafreshmen/flags';
import { getFlagOverrides } from './dev/flag-overrides';

// Dev-toolbar overrides are stored in localStorage (browser + dev build only,
// see lib/dev/flag-overrides.ts) and read once at module load. Toggling a
// flag in the toolbar reloads the page so this picks up the new value.
// enabledAll mirrors apiApp's server-side bypass (lib/server/api.ts) so
// non-production (local + staging) is unlocked by default here too, not
// just on the API - previously only the dev toolbar's per-browser override
// could unlock it client-side, so staging stayed gated by the real festival
// schedule unless someone flipped it in localStorage themselves.
export const flags = new FeatureFlags({
	enabledAll: env.PUBLIC_WORKER_ENV !== 'production',
	overrides: getFlagOverrides()
});
