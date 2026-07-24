import type { createAuth } from "@vidyafreshmen/auth";
import type { Db } from "@vidyafreshmen/db";
import type { FeatureFlags } from "@vidyafreshmen/flags";
import { createMiddleware } from "hono/factory";

// db/flags are built in the SvelteKit API endpoint and handed down through
// context. Importing `cloudflare:workers` directly from this shared package
// would leak the app's ambient Env into every consumer of this package.
type AuthInstance = ReturnType<typeof createAuth>;

export type Variables = {
  user: AuthInstance["$Infer"]["Session"]["user"] | null;
  session: AuthInstance["$Infer"]["Session"]["session"] | null;
  db: Db;
  flags: FeatureFlags;
  // Turnstile bot-check on public forms (registration) is production-only -
  // set from WORKER_ENV, same convention as flags' enabledAll bypass.
  isProduction: boolean;
  turnstileSecret: string | undefined;
};

// Runs after the API endpoint's session-extraction middleware has populated
// `user`/`session` on the shared Hono context - just gates the route.
export const requireUser = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    if (!c.get("user")) {
      return c.json(
        { error: "You must be signed in to perform this action." },
        401,
      );
    }
    await next();
  },
);

// Must run after requireUser - relies on `user` already being populated.
export const requireAdmin = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    if (c.get("user")?.role !== "admin") {
      return c.json(
        { error: "You must be an admin to perform this action." },
        403,
      );
    }
    await next();
  },
);

// Must run after requireUser. Admins can also use the check-in scanner.
export const requireStaff = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const role = c.get("user")?.role;
    if (role !== "staff" && role !== "admin") {
      return c.json(
        { error: "You must be staff to perform this action." },
        403,
      );
    }
    await next();
  },
);
