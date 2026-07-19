import type { auth } from '@vidyafreshmen/auth';
import type { Db } from '@vidyafreshmen/db';
import type { FeatureFlags } from '@vidyafreshmen/flags';
import { createMiddleware } from 'hono/factory';

// db/flags are built in apps/api (the only place the Cloudflare Worker's
// ambient `Env`/`cloudflare:workers` types are guaranteed correct) and handed
// down through context - importing `cloudflare:workers` directly from this
// shared package would pull in apps/api's ambient Env globally, which then
// conflicts with apps/web's own (different) Worker env types wherever this
// package's source is type-checked as a dependency.
export type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  db: Db;
  flags: FeatureFlags;
};

// Runs after apps/api's global session-extraction middleware has populated
// `user`/`session` on the shared Hono context - just gates the route.
export const requireUser = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  if (!c.get('user')) {
    return c.json({ error: 'You must be signed in to perform this action.' }, 401);
  }
  await next();
});
