import posthog from 'posthog-js';
import { browser, dev } from '$app/environment';

import type { LayoutLoad } from "./$types";
import { trpcClient } from "$lib/trpc";
import { isTRPCClientError } from '@trpc/client';
import { flags } from '$lib/flags';

// export const ssr = false;
// export const prerender = true;

export const load: LayoutLoad = async ({ fetch, depends }) => {
  if (browser && !dev && flags.isEnabled("login")) {
    posthog.init(
      "phc_bqj7hpCaSlG95HYriP1UoqIMBPMu3LqOoFvPD1My4xn",
      {
        api_host: "https://us.i.posthog.com",
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: true, // This enables capturing exceptions using Error Tracking
      }
    );
  }

  try {
    const [whoami] = await Promise.all([
      trpcClient({ fetch }).user.whoami.query(),
    ]);
    return {
      whoami,
    };
  } catch (error) {
    if (isTRPCClientError(error)) {
      console.error("TRPC Client Error:", error.message);
    } else {
      console.error("Unexpected Error:", error);
    }
    return {
      whoami: null
    };
  }
};