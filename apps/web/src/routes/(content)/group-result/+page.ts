import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { flashParams } from '$lib/flash.svelte';
import { flags } from '$lib/flags';
import { apiClient, call } from '$lib/api';
import { groupData } from '$lib/groups';

export const load: PageLoad = async ({ parent }) => {
	const { whoami } = await parent();
	if (!whoami) {
		redirect(307, `/?${flashParams('please-login')}`);
	}

	if (!flags.isEnabled('group-announcement')) {
		redirect(307, `/menu?${flashParams('not-yet-start')}`);
	}

	const client = apiClient();
	const [ownedTeam, joinedTeam] = await Promise.all([
		call(client.team.owned.$get()),
		call(client.team.joined.$get())
	]).catch((e) => {
		console.warn(e);
		// actually wtf
		redirect(307, `/menu?${flashParams('unknown-error')}`);
	});

	const groupResult = joinedTeam?.resultGroupNumber ?? ownedTeam?.resultGroupNumber ?? null;

	return {
		ownedTeam,
		joinedTeam,
		groupData,
		groupResult
	};
};
