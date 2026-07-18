import type { auth } from '@vidyafreshmen/auth';
import type { Db } from '@vidyafreshmen/db';
import type { FeatureFlags } from '@vidyafreshmen/flags';
import { initTRPC, TRPCError } from '@trpc/server';

export type Context = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
  db: Db;
  flags: FeatureFlags;
};

export type AuthenticatedContext = Context & {
  user: NonNullable<Context["user"]>;
  session: NonNullable<Context["session"]>;
};

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;
export const signedInProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action.',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    }
  });
});

export const router = t.router;
