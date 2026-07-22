import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { flashParams } from '$lib/flash.svelte';

export const load: PageLoad = async ({ parent }) => {
	const { whoami } = await parent();
	if (!whoami) {
		redirect(307, `/?${flashParams('please-login')}`);
	}

	return { whoami };
};
