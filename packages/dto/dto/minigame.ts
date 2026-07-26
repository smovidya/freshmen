import z from "zod/v4";

// Quiz is intentionally disabled until a reviewed question bank and content
// management path exist. Keeping it out of this list also removes it from the
// shop, milestone and QTE lotteries.
export const TICKETED_GAME_TYPES = ["puzzle", "precision", "wheel"] as const;
export const GAME_TYPES = [...TICKETED_GAME_TYPES, "mystery_box"] as const;

export const minigameStartSchema = z.object({
  playToken: z.string().uuid(),
});

export const puzzleSubmitSchema = z.object({
  playToken: z.string().uuid(),
  x: z.number(),
  y: z.number(),
});

export const precisionSubmitSchema = z.object({
  playToken: z.string().uuid(),
  tapOffsetsMs: z.array(z.number().finite().min(0).max(15_000)).max(24),
  clientDurationMs: z.number().finite().min(0).max(20_000),
});

export const wheelPlaySchema = minigameStartSchema;
export const wheelClaimSchema = minigameStartSchema;

export const mysteryBoxOpenSchema = minigameStartSchema;

// Outcome keys (pts_100, buff_x100, ...) are legacy naming kept for stored
// rows (active_buffs, unclaimed wheel plays' serverState) - labels carry the
// true current values, which have moved on twice since: buff_x100 grants x50
// (post score-inflation-incident retune; buffs multiply shake pops only, see
// BUFF_ELIGIBLE_SOURCES in dto/game.ts), and every currency amount (this
// wheel's payouts included - see pointsForOutcome in services/minigame/wheel.ts)
// was rescaled x10 for bigger, faster-feeling numbers.
export const WHEEL_OUTCOMES = [
  { key: "skull", label: "MISS", color: "#3f3f46", weight: 10 },
  { key: "pts_100", label: "1000", color: "#fde68a", weight: 30 },
  { key: "pts_200", label: "2000", color: "#fdba74", weight: 25 },
  { key: "pts_300", label: "3000", color: "#fca5a5", weight: 20 },
  { key: "pts_1000", label: "10000", color: "#f87171", weight: 5 },
  { key: "buff_x3", label: "x3", color: "#86efac", weight: 7 },
  { key: "buff_x100", label: "x50", color: "#67e8f9", weight: 3 },
] as const;

export type WheelOutcome = (typeof WHEEL_OUTCOMES)[number]["key"];
