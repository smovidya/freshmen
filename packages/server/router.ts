import { Hono } from 'hono';
import type { Variables } from './core';
import { teamRouter } from './routers/team';
import { userRouter } from './routers/user';

export const apiRouter = new Hono<{ Variables: Variables }>()
  .route('/user', userRouter)
  .route('/team', teamRouter)
  .onError((err, c) => {
    // Service functions throw plain Errors for business-logic failures (not
    // every failure path returns a typed {error} response) - surface the
    // message the same way trpc used to instead of a bare 500 text response.
    console.error(err);
    return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500);
  });

export type ApiRouter = typeof apiRouter;
