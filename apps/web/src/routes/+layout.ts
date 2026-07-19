import type { LayoutLoad } from "./$types";
import { apiClient, call } from "$lib/api";

// export const ssr = false;
// export const prerender = true;

export const load: LayoutLoad = async ({ fetch, depends }) => {
  try {
    const [whoami] = await Promise.all([
      call(apiClient({ fetch }).user.whoami.$get()),
    ]);
    return {
      whoami,
    };
  } catch (error) {
    console.error("API Client Error:", error);
    return {
      whoami: null
    };
  }
};
