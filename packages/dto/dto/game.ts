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

// Turnstile pass, accepted as a query param alongside whatever body schema a
// route already has (pop-token bootstrap, ticket purchase, minigame submits)
// - required (and verified) in production only; staging/local have no widget
// so the field stays unset. Optional here because most calls don't need a
// fresh solve at all (requireTurnstile in turnstile-gate.ts first checks
// whether this user verified recently before demanding one).
export const turnstileQuerySchema = z.object({
  turnstileToken: z.string().optional()
});
