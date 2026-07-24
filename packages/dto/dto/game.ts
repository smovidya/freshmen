import z from "zod/v4";

export const MAX_POP_PER_REQUEST = 110;

export const submitPopSchema = z.object({
  pop: z.number().int().min(1).max(MAX_POP_PER_REQUEST),
  token: z.string().uuid()
});
