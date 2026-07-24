import { requireGameAccess } from '$lib/game-guard';
import { GAME_TYPES } from '@vidyafreshmen/dto';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const { whoami } = await parent();
	requireGameAccess(whoami);

	if (!GAME_TYPES.includes(params.type as (typeof GAME_TYPES)[number])) {
		error(404, 'ไม่พบมินิเกมนี้');
	}

	return { whoami, gameType: params.type as (typeof GAME_TYPES)[number] };
};
