import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure, router, signedInProcedure } from '../core';
import { teamRouter } from './team';
import { userRouter } from './user';
import { tables } from '@vidyafreshmen/db';
import { eq } from 'drizzle-orm';

export const appRouter = router({
  hello: publicProcedure.input(z.string().nullish()).query(({ input }) => {
    return `hello ${input ?? 'world'}`;
  }),
  team: teamRouter,
  user: userRouter,
  // getSomeId: signedInProcedure
  //   .query(async ({ ctx, input }) => {
  //     const email = ctx.user.email;
  //     const db = ctx.db;
  //     const result = await db
  //       .select({
  //         groupNumberPreferenceOrder: tables.teams.groupNumberPreferenceOrder
  //         result: "result"
  //       })
  //       .from(tables.students)
  //       .innerJoin(tables.teams, eq(tables.teams.id, tables.students.teamOwnedId))
  //       .where(eq(tables.students.email, email))
  //       .limit(1);

  //     if (result.length === 0) {
  //       throw new Error('User or team not found');
  //     }

  //     const preferenceString = result[0]!.groupNumberPreferenceOrder;

  //     // Convert comma-separated string back to array
  //     return preferenceString ? preferenceString.split(",") : [];

  //   })
});

export type AppRouter = typeof appRouter;
export type AppRouterInput = inferRouterInputs<AppRouter>;
export type AppRouterOutput = inferRouterOutputs<AppRouter>;
