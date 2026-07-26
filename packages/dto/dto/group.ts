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

export const transferUserGroupSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  toGroupNumber: z.string().min(1, "Destination group is required"),
  // New boeing (subgroup) number - required server-side when the person has a
  // boeing assignment and the destination is a numeric airline; irrelevant
  // (and ignored) for staff pseudo-group destinations.
  subgroupNumber: z.number().int().min(1).max(99).optional()
});