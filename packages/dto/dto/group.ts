import z from "zod/v4";

export const groupPreferenceSchema = z.array(
  z.number()
);

export const updateUserGroupSchema = z.object({
  groupCode: z.string().min(1, "Group code is required")
});

export const updateGroupPasswordSchema = z.object({
  password: z.string().min(1, "Password is required")
});