import { flashParams } from '$lib/flash.svelte';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Open to any signed-in user (was admin-only for the staff-room projector -
// now public within the app so everyone can watch standings). API endpoints
// mirror this gate server-side (requireUser, not requireAdmin, on
// /api/game/scoreboard-public and /scoreboard-top10/:groupNumber).
export const load: PageLoad = async ({ parent }) => {
	const { whoami } = await parent();

	if (!whoami) {
		redirect(307, `/?${flashParams('please-login')}`);
	}

	return { whoami };
};
