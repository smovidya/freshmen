import z from "zod/v4";

export const BUFF_ITEMS = ["buff_x3", "buff_x100"] as const;

export const redeemBuffSchema = z.object({
  item: z.enum(BUFF_ITEMS),
});
