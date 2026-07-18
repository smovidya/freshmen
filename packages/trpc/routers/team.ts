import { groupPreferenceSchema } from "@vidyafreshmen/dto";
import { TRPCError } from "@trpc/server";
import z from "zod/v4";
import { router, signedInProcedure } from "../core";
import { updateGroupPreference } from "../services/group.service";
import { getJoinedTeam, getOwnedTeam, joinTeam, kickOwnedTeamMemeber, leaveJoinedTeam, regenerateTeamCode } from "../services/team.service";

export const teamRouter = router({
  join: signedInProcedure
    .input(z.string().length(4))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.flags.isEnabled("team-joining")) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'ขณะนี้ปิดการเข้าร่วมทีมอยู่',
        });
      }
      return await joinTeam(ctx.user.email, input, ctx.db);
    }),
  regenerateTeamCode: signedInProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.flags.isEnabled("team-joining")) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'ไม่สามารถสร้างโค้ดทีมใหม่ได้ในขณะนี้',
        });
      }
      await regenerateTeamCode(ctx.user.email, ctx.db);
    }),
  updateGroupPreference: signedInProcedure
    .input(groupPreferenceSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.flags.isEnabled("group-choosing")) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'ไม่สามารถอัปเดตการตั้งค่ากลุ่มได้ในขณะนี้',
        });
      }
      await updateGroupPreference(ctx.user.email, input, ctx.db);
    }),
  getOwnedTeam: signedInProcedure
    .query(async ({ ctx }) => {
      return await getOwnedTeam(ctx.user.email, ctx.db);
    }),
  getJoinedTeam: signedInProcedure
    .query(async ({ ctx }) => {
      return await getJoinedTeam(ctx.user.email, ctx.db);
    }),
  leaveJoinedTeam: signedInProcedure
    .mutation(async ({ ctx }) => {
      if (!ctx.flags.isEnabled("team-joining")) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'ไม่สามารถออกจากทีมได้ในขณะนี้',
        });
      }
      return await leaveJoinedTeam(ctx.user.email, ctx.db);
    }),
  kickOwnedTeamMemeber: signedInProcedure
    .input(z.email())
    .mutation(async ({ ctx, input }) => {
      if (!ctx.flags.isEnabled("team-joining")) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'ไม่สามารถไล่สมาชิกออกจากทีมได้ในขณะนี้',
        });
      }
      return await kickOwnedTeamMemeber(ctx.user.email, input, ctx.db);
    })
});
