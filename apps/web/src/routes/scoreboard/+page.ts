import { flashParams } from '$lib/flash.svelte';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Admin-only: the projector scoreboard is for the staff room, not the public.
// Mirrors routes/admin/+layout.ts; the API endpoint enforces the same gate
// server-side (requireAdmin on /api/game/scoreboard-public).
export const load: PageLoad = async ({ parent }) => {
	const { whoami } = await parent();

	if (!whoami) {
		redirect(307, `/?${flashParams('please-login')}`);
	}

	if (whoami.role !== 'admin') {
		redirect(307, `/?${flashParams('unauthorized')}`);
	}

	return { whoami };
};
