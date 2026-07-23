import { groupPreferenceSchema } from '@vidyafreshmen/dto';
import type { FeatureFlags } from '@vidyafreshmen/flags';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import z from 'zod/v4';
import { requireUser, type Variables } from '../core';
import { updateGroupPreference } from '../services/group.service';
import {
  getJoinedTeam,
  getOwnedTeam,
  joinTeam,
  kickOwnedTeamMemeber,
  leaveJoinedTeam,
  regenerateTeamCode
} from '../services/team.service';

const joinBodySchema = z.object({ code: z.string().length(4) });
const kickBodySchema = z.object({ email: z.email() });

// Group results come back from the DB join regardless of festival schedule,
// so this is the enforcement point keeping them hidden until announcement time
// (the client-side check in boarding-pass.svelte is UX only, not a guarantee).
function maskGroupResultUnlessAnnounced<T extends { resultGroupNumber: number | null; subgroupNumber: number | null } | null>(
  team: T,
  flags: FeatureFlags
): T {
  if (!team || flags.isEnabled('group-announcement')) {
    return team;
  }
  return { ...team, resultGroupNumber: null, subgroupNumber: null };
}

export const teamRouter = new Hono<{ Variables: Variables }>()
  .post('/join', requireUser, zValidator('json', joinBodySchema), async (c) => {
    if (!c.get('flags').isEnabled('team-joining')) {
      return c.json({ error: 'ขณะนี้ปิดการเข้าร่วมทีมอยู่' }, 403);
    }
    const user = c.get('user')!;
    const result = await joinTeam(user.email, c.req.valid('json').code, c.get('db'));
    return c.json(result);
  })
  .post('/regenerate-code', requireUser, async (c) => {
    if (!c.get('flags').isEnabled('team-joining')) {
      return c.json({ error: 'ไม่สามารถสร้างโค้ดทีมใหม่ได้ในขณะนี้' }, 403);
    }
    const user = c.get('user')!;
    await regenerateTeamCode(user.email, c.get('db'));
    return c.json({ ok: true });
  })
  .put('/group-preference', requireUser, zValidator('json', groupPreferenceSchema), async (c) => {
    if (!c.get('flags').isEnabled('group-choosing')) {
      return c.json({ error: 'ไม่สามารถอัปเดตการตั้งค่ากลุ่มได้ในขณะนี้' }, 403);
    }
    const user = c.get('user')!;
    await updateGroupPreference(user.email, c.req.valid('json'), c.get('db'));
    return c.json({ ok: true });
  })
  .get('/owned', requireUser, async (c) => {
    const user = c.get('user')!;
    const team = await getOwnedTeam(user.email, c.get('db'));
    return c.json(maskGroupResultUnlessAnnounced(team, c.get('flags')));
  })
  .get('/joined', requireUser, async (c) => {
    const user = c.get('user')!;
    const team = await getJoinedTeam(user.email, c.get('db'));
    return c.json(maskGroupResultUnlessAnnounced(team, c.get('flags')));
  })
  .post('/leave', requireUser, async (c) => {
    if (!c.get('flags').isEnabled('team-joining')) {
      return c.json({ error: 'ไม่สามารถออกจากทีมได้ในขณะนี้' }, 403);
    }
    const user = c.get('user')!;
    const result = await leaveJoinedTeam(user.email, c.get('db'));
    return c.json(result);
  })
  .post('/kick', requireUser, zValidator('json', kickBodySchema), async (c) => {
    if (!c.get('flags').isEnabled('team-joining')) {
      return c.json({ error: 'ไม่สามารถไล่สมาชิกออกจากทีมได้ในขณะนี้' }, 403);
    }
    const user = c.get('user')!;
    const result = await kickOwnedTeamMemeber(user.email, c.req.valid('json').email, c.get('db'));
    return c.json(result);
  });
