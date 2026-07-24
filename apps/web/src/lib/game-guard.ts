import { flashParams } from '$lib/flash.svelte';
import { redirect } from '@sveltejs/kit';
import { flags } from '$lib/flags';

type Whoami = { ouid: string; role?: string | null; group: string | null } | null;

// Shared by every page under /game (the main game, shop, friends, minigames)
// - keeps the freshman/staff/central-staff gating and the "join a group
// first" redirect consistent across all of them instead of drifting.
// redirect() throws (return type `never`), so this is a TS assertion
// function: after it returns normally, `whoami` is narrowed non-null for
// the rest of the caller's load function.
export function requireGameAccess(
	whoami: Whoami,
	{ requireGroup = true }: { requireGroup?: boolean } = {}
): asserts whoami is NonNullable<Whoami> {
	if (!whoami) {
		redirect(307, `/menu?${flashParams('dont-rush')}`);
	}

	const isFreshman = whoami.ouid.startsWith('69');
	const isStaffOrAdmin = whoami.role === 'staff' || whoami.role === 'admin';
	if (
		flags.isEnabled('game-playing') &&
		!isFreshman &&
		!isStaffOrAdmin &&
		!flags.isEnabled('game-allow-non-freshmen')
	) {
		redirect(307, `/menu?${flashParams('not-allowed')}`);
	}

	if (requireGroup && !whoami.group) {
		redirect(307, '/game');
	}
}
