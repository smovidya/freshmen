import { flashParams } from '$lib/flash.svelte';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
	const { whoami } = await parent();

	if (!whoami) {
		redirect(307, `/?${flashParams('please-login')}`);
	}

	if (whoami.role !== 'admin') {
		redirect(307, `/?${flashParams('unauthorized')}`);
	}

	return { whoami };
};
