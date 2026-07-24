import { requireGameAccess } from '$lib/game-guard';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { whoami } = await parent();
	requireGameAccess(whoami);
	return { whoami };
};
