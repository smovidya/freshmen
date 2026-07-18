import { browser, dev } from '$app/environment';
import { features } from '@vidyafreshmen/flags';

export type FlagKey = keyof typeof features;

export const flagKeys = Object.keys(features) as FlagKey[];

const STORAGE_KEY = 'vidyafreshmen:dev-flag-overrides';

// true/false forces the flag on/off (bypassing any time window); absent = default behavior.
export type FlagOverrides = Partial<Record<FlagKey, boolean>>;

export function getFlagOverrides(): FlagOverrides {
	if (!dev || !browser) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

export function setFlagOverride(key: FlagKey, value: boolean | null) {
	if (!dev || !browser) return;
	const overrides = getFlagOverrides();
	if (value === null) {
		delete overrides[key];
	} else {
		overrides[key] = value;
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function clearFlagOverrides() {
	if (!dev || !browser) return;
	localStorage.removeItem(STORAGE_KEY);
}
