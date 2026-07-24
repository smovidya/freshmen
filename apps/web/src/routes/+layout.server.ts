import type { LayoutServerLoad } from './$types';

// The dev toolbar is gated on Vite's build-time `dev` flag everywhere except
// here - that's `false` for every deployed Worker (prod AND staging alike,
// since both are `vite build` output). Staging (WORKER_ENV != "production")
// should still show it, so expose that at runtime instead of relying only
// on build mode.
export const load: LayoutServerLoad = async ({ platform }) => {
	return {
		isNonProduction: !platform || platform.env.WORKER_ENV !== 'production'
	};
};
