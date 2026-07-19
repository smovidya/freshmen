import { registrationSchema, updateUserGroupSchema } from '@vidyafreshmen/dto';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { requireUser, type Variables } from '../core';
import { updateUserGroup } from '../services/game.service';
import {
  createStudentWithTeam,
  getStudentByEmail,
  isRegistered,
  updateStudentInfo
} from '../services/students.service';

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
    const user = c.get('user')!;
    await createStudentWithTeam(c.req.valid('json'), user.email, c.get('db'));
    return c.json({ ok: true });
  })
  .put('/student-info', requireUser, zValidator('json', registrationSchema), async (c) => {
    if (!c.get('flags').isEnabled('registering')) {
      return c.json({ error: 'Registration is not open at the moment' }, 403);
    }
    const user = c.get('user')!;
    await updateStudentInfo(c.req.valid('json'), user.email, c.get('db'));
    return c.json({ ok: true });
  })
  .post('/group', requireUser, zValidator('json', updateUserGroupSchema), async (c) => {
    const user = c.get('user')!;
    await updateUserGroup(user.email, c.req.valid('json').groupCode, c.get('db'));
    return c.json({ ok: true });
  });
