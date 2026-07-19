import { flashParams } from "$lib/flash.svelte";
import { apiClient, call } from "$lib/api";
import { registrationSchema } from "@vidyafreshmen/dto";
import { redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import type { PageLoad } from "./$types";
import { flags } from "$lib/flags";

type MapNullToUndefined<T> = T extends null
  ? undefined
  : T extends object
  ? { [K in keyof T]: MapNullToUndefined<T[K]> }
  : T;

function mapToUndefined<T>(obj: T): MapNullToUndefined<T> {
  if (obj === null || obj === undefined) {
    return undefined as MapNullToUndefined<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map(mapToUndefined) as MapNullToUndefined<T>;
  }

  if (typeof obj === 'object') {
    const result = {} as MapNullToUndefined<T>;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        (result as any)[key] = mapToUndefined(obj[key]);
      }
    }
    return result;
  }

  return obj as MapNullToUndefined<T>;
}

export const load: PageLoad = async ({ fetch, parent }) => {
  const { whoami } = await parent();
  if (!whoami) {
    redirect(307, `/?${flashParams("please-login")}`);
  }

  if (!flags.isEnabled('registering')) {
    redirect(307, `/menu?${flashParams("not-yet-start")}`);
  }


  const student = await call(apiClient({ fetch }).user["student-info"].$get());

  const form = await superValidate(student ? mapToUndefined(student) : {}, zod4(registrationSchema), {
    errors: false
  });

  return {
    form,
    isRegistered: !!student
  };
};