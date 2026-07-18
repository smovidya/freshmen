import { env } from '$env/dynamic/public';
import type { AppRouter } from '@vidyafreshmen/trpc';
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import { dev } from '$app/environment';

interface Options {
  fetch?: typeof fetch;
}

export const trpcClient = ({ fetch = globalThis.fetch }: Options = {}) => createTRPCClient<AppRouter>({
  links: [
    dev ? loggerLink() : null,
    httpBatchLink({
      fetch: (url, options) => fetch(url, {
        ...options,
        credentials: "include"
      }),
      url: env.PUBLIC_TRPC_URL || 'http://localhost:8787/trpc',
    })
  ].filter((op) => {
    return op !== null && op !== undefined;
  }),
});
