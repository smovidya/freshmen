import z from "zod/v4";

export const createStaffSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  name: z.string().min(1, "Name is required"),
  nickname: z.string().optional(),
  staffRole: z.string().min(1, "Staff role is required"),
});
