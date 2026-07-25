import type { createAuth } from "@vidyafreshmen/auth";
import type { Db } from "@vidyafreshmen/db";
import type { FeatureFlags } from "@vidyafreshmen/flags";
import { createMiddleware } from "hono/factory";

// db/flags are built in the SvelteKit API endpoint and handed down through
// context. Importing `cloudflare:workers` directly from this shared package
// would leak the app's ambient Env into every consumer of this package.
type AuthInstance = ReturnType<typeof createAuth>;

// Minimal structural subset of the Workers `Cache` interface - deliberately
// not importing @cloudflare/workers-types' `Cache`/`caches` global into this
// package (same reasoning as the comment above: stay Env/platform-agnostic).
// `caches.default` from the actual Workers runtime satisfies this shape
// structurally, so the SvelteKit endpoint can hand it straight through.
export type SimpleCache = {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
};

export type Variables = {
  user: AuthInstance["$Infer"]["Session"]["user"] | null;
  session: AuthInstance["$Infer"]["Session"]["session"] | null;
  db: Db;
  flags: FeatureFlags;
  cache: SimpleCache;
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

// Shared gate for every gameplay-adjacent endpoint (pop, leaderboard,
// minigames, the QTE popup). Lives here (not routers/game.ts) so routers
// that need it - routers/qte.ts in particular - can import it without a
// circular routers/game.ts <-> routers/qte.ts dependency (game.ts mounts
// qte.ts via .route()).
export const requireGameOn = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(
        { error: "You must be signed in to perform this action." },
        401,
      );
    }
    // Staff/admin can exercise gameplay endpoints regardless of the
    // game-playing window - lets festival staff test/support the game before
    // (or between) the real freshmen-facing window, without opening it early
    // for everyone else.
    const isStaffOrAdmin = user.role === "staff" || user.role === "admin";
    if (!isStaffOrAdmin && !c.get("flags").isEnabled("game-playing")) {
      return c.json({ error: "เกมไม่เปิดให้เล่นในขณะนี้" }, 403);
    }
    if (!user.group) {
      return c.json({ error: "กรุณาเข้าร่วมกลุ่มก่อนเล่นเกม" }, 400);
    }
    await next();
  },
);
