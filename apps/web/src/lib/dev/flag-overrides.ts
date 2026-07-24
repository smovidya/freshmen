import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { features } from '@vidyafreshmen/flags';

export type FlagKey = keyof typeof features;

export const flagKeys = Object.keys(features) as FlagKey[];

const STORAGE_KEY = 'vidyafreshmen:dev-flag-overrides';

// Runtime check, not Vite's build-time `dev` - `dev` is false for every
// deployed Worker (prod AND staging alike, both are `vite build` output),
// which silently no-op'd every function below on staging. PUBLIC_WORKER_ENV
// mirrors the server-only WORKER_ENV var (apps/web/wrangler.jsonc) so this
// works the same way apiApp's enabledAll bypass already does.
const isNonProduction = env.PUBLIC_WORKER_ENV !== 'production';

// true/false forces the flag on/off (bypassing any time window); absent = default behavior.
export type FlagOverrides = Partial<Record<FlagKey, boolean>>;

export function getFlagOverrides(): FlagOverrides {
	if (!isNonProduction || !browser) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

export function setFlagOverride(key: FlagKey, value: boolean | null) {
	if (!isNonProduction || !browser) return;
	const overrides = getFlagOverrides();
	if (value === null) {
		delete overrides[key];
	} else {
		overrides[key] = value;
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function clearFlagOverrides() {
	if (!isNonProduction || !browser) return;
	localStorage.removeItem(STORAGE_KEY);
}
