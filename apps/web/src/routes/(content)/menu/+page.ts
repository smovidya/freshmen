import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { flashParams } from "$lib/flash.svelte";
import { apiClient, call } from "$lib/api";
import posthog from 'posthog-js';
import { dev } from '$app/environment';

export const load: PageLoad = async ({ parent, fetch, depends }) => {
  const { whoami } = await parent();
  if (!whoami) {
    redirect(307, `/?${flashParams("please-login")}`);
  }

  if (!dev) {
    posthog.identify(
      whoami.id,  // Replace 'distinct_id' with your user's unique identifier
      { email: whoami.email, name: whoami.name } // optional: set additional person properties
    );
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