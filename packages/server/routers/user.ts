import { registrationSchema, updateUserGroupSchema } from '@vidyafreshmen/dto';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { requireUser, type Variables } from '../core';
import { updateUserGroup } from '../services/game.service';
import { verifyTurnstileToken } from '../turnstile';
import {
  createStudentWithTeam,
  getStudentByEmail,
  isRegistered,
  updateStudentInfo
} from '../services/students.service';
import type { Context } from 'hono';

// Registration is the one public-data-creating form in this app, and the
// prime bot-abuse target - gated production-only (isProduction, set from
// WORKER_ENV in apps/web/src/lib/server/api.ts) since the widget's domain
// registration and PUBLIC_TURNSTILE_SITE_KEY only exist on production
// (apps/web/wrangler.jsonc). Staging/local never send a token and are
// never asked to.
async function requireTurnstileInProduction(c: Context<{ Variables: Variables }>, token: string | undefined) {
  if (!c.get('isProduction')) return true;
  return verifyTurnstileToken({
    token,
    secret: c.get('turnstileSecret'),
    remoteIp: c.req.header('cf-connecting-ip') ?? undefined
  });
}

export const userRouter = new Hono<{ Variables: Variables }>()
  .get('/whoami', (c) => {
    return c.json(c.get('user') ?? null);
  })
  .get('/student-info', requireUser, async (c) => {
    const user = c.get('user')!;
    return c.json((await getStudentByEmail(user.email, c.get('db'))) ?? null);
  })
  .get('/is-registered', requireUser, async (c) => {
    const user = c.get('user')!;
    return c.json(await isRegistered(user.email, c.get('db')));
  })
  .post('/register', requireUser, zValidator('json', registrationSchema), async (c) => {
    if (!c.get('flags').isEnabled('registering')) {
      return c.json({ error: 'Registration is not open at the moment' }, 403);
    }
    const body = c.req.valid('json');
    if (!(await requireTurnstileInProduction(c, body.turnstileToken))) {
      return c.json({ error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, 403);
    }
    const user = c.get('user')!;
    await createStudentWithTeam(body, user.email, c.get('db'));
    return c.json({ ok: true });
  })
  .put('/student-info', requireUser, zValidator('json', registrationSchema), async (c) => {
    if (!c.get('flags').isEnabled('registering')) {
      return c.json({ error: 'Registration is not open at the moment' }, 403);
    }
    const body = c.req.valid('json');
    if (!(await requireTurnstileInProduction(c, body.turnstileToken))) {
      return c.json({ error: 'ยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' }, 403);
    }
    const user = c.get('user')!;
    await updateStudentInfo(body, user.email, c.get('db'));
    return c.json({ ok: true });
  })
  .post('/group', requireUser, zValidator('json', updateUserGroupSchema), async (c) => {
    const user = c.get('user')!;
    await updateUserGroup(user.email, c.req.valid('json').groupCode, c.get('db'));
    return c.json({ ok: true });
  });
