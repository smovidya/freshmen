import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { flashParams } from "$lib/flash.svelte";
import { apiClient, call } from "$lib/api";

export const load: PageLoad = async ({ parent, fetch, depends }) => {
  const { whoami } = await parent();
  if (!whoami) {
    redirect(307, `/?${flashParams("please-login")}`);
  }

  depends("data:owned-team", "data:joined-team");
  const client = apiClient({ fetch });
  const [isRegistered, ownedTeam, joinedTeam] = await Promise.all([
    call(client.user["is-registered"].$get()),
    call(client.team.owned.$get()),
    call(client.team.joined.$get())
  ]);

  return {
    whoami,
    isRegistered,
    team: joinedTeam ?? ownedTeam
  };
};
