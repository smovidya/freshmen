import z from "zod/v4";

export const qteClaimSchema = z.object({
  id: z.string().uuid(),
});
