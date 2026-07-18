import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { parse } from '@vanillaes/csv';
import rawData from "$lib/data/results_team_processed_with_groups.csv?raw";
import { flashParams } from "$lib/flash.svelte";
import { flags } from "$lib/flags";
import { trpcClient } from "$lib/trpc";
import { groupData } from "$lib/groups";

export const load: PageLoad = async ({ parent }) => {
  const { whoami } = await parent();
  if (!whoami) {
    redirect(307, `/?${flashParams("please-login")}`);
  }

  if (!flags.isEnabled('group-announcement')) {
    redirect(307, `/menu?${flashParams("not-yet-start")}`);
  }

  const [ownedTeam, joinedTeam] = await Promise.all([
    trpcClient({ fetch }).team.getOwnedTeam.query(),
    trpcClient({ fetch }).team.getJoinedTeam.query()
  ]).catch((e) => {
    console.warn(e);
    // actually wtf
    redirect(307, `/menu?${flashParams("unknown-error")}`);
  });

  const id = joinedTeam?.id ?? ownedTeam?.id;
  console.log(id);
  const parsed = parse(rawData);
  const row = parsed.find(it => it[0] === id);
  if (!row) {
    return {
      ownedTeam,
      joinedTeam,
      groupData,
      groupResult: null
    };
  }

  const groupResult = Number(row[row.length - 1]);

  return {
    ownedTeam,
    joinedTeam,
    groupData,
    groupResult
  };
};