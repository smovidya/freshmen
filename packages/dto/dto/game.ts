import z from "zod/v4";

export const MAX_POP_PER_REQUEST = 110;

// The only credit sources the active-buff multiplier applies to. Everything
// else (minigames, referrals, free claims, refunds) credits its base amount -
// multiplying fixed rewards is what produced the 50,000-point ledger rows
// during the uncapped-x100 era.
export const BUFF_ELIGIBLE_SOURCES = ["shake_pop"] as const;

export const submitPopSchema = z.object({
  pop: z.number().int().min(1).max(MAX_POP_PER_REQUEST),
  token: z.string().uuid()
});

// Turnstile pass for bootstrapping a pop session - required (and verified)
// in production only; staging/local have no widget so the field stays unset.
export const popTokenQuerySchema = z.object({
  turnstileToken: z.string().optional()
});
