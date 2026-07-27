import z from "zod/v4";

// Points credited per detected shake gesture on the client (game.svelte.ts's
// GamePopper.pop()) - rescaled from 1 alongside every other currency amount
// in the economy, so pops feel proportionally as generous as everything
// else. The physical shake rate is unchanged (still gated client-side by
// SHAKE_COOLDOWN_MS in game-on.svelte, ~2.5/s) - only the value of each one
// went up.
export const POINTS_PER_POP = 100;

// Sanity ceiling on points reportable in a single /game/pop request. Scales
// with POINTS_PER_POP - the real bot-guard is game.service.ts's elapsed-time
// throttle (MAX_TAPS_PER_SECOND), which bounds *physical* tap plausibility
// regardless of what a request claims. This constant only needs enough
// headroom that legitimate flushes (many pops batched over the ~10s client
// flush interval) never get clamped by it before the rate throttle even
// applies.
//
// Not enforced at the schema/validation level (see submitPopSchema below) -
// a client that goes a long time between flushes (backgrounded tab, network
// drop) can legitimately batch past this before its next successful send.
// Rejecting that request outright would drop the whole batch to zero; instead
// game.service.ts's addPop() clamps requestedAmount to this ceiling itself
// and still credits whatever the elapsed-time throttle allows.
export const MAX_POP_PER_REQUEST = 11_000;

// The only credit sources the active-buff multiplier applies to. Everything
// else (minigames, referrals, free claims, refunds) credits its base amount -
// multiplying fixed rewards is what produced the 50,000-point ledger rows
// during the uncapped-x100 era.
export const BUFF_ELIGIBLE_SOURCES = ["shake_pop"] as const;

export const submitPopSchema = z.object({
  pop: z.number().int().min(1),
  token: z.string().uuid(),
});

// Turnstile pass, accepted as a query param alongside whatever body schema a
// route already has (pop-token bootstrap, ticket purchase, minigame submits)
// - required (and verified) in production only; staging/local have no widget
// so the field stays unset. Optional here because most calls don't need a
// fresh solve at all (requireTurnstile in turnstile-gate.ts first checks
// whether this user verified recently before demanding one).
export const turnstileQuerySchema = z.object({
  turnstileToken: z.string().optional(),
});
