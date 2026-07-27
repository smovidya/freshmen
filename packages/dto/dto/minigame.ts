import z from "zod/v4";

// Quiz is intentionally disabled until a reviewed question bank and content
// management path exist. Keeping it out of this list also removes it from the
// shop, milestone and QTE lotteries. Puzzle (alignment/drag) was removed
// entirely per product decision - packages/server/services/minigame/puzzle.ts
// no longer exists.
export const CLASSIC_TICKETED_GAME_TYPES = ["precision", "wheel"] as const;

// Arcade games (fun-first batch): each is a self-contained client-side round
// that reports one final raw score at game-over - unlike precision/wheel,
// there's no per-game grading logic on the server beyond mapping that number
// through the shared reward ladder (see ARCADE_GAMES below), so they all share
// one generic start/submit implementation (services/minigame/arcade.ts)
// instead of a bespoke service file each.
export const ARCADE_GAME_TYPES = [
  "quick_math",
  "whack_a_mole",
  "flappy_runner",
  "merge_2048",
  "memory_match",
  "stack_tower",
  "color_switch",
  "slingshot_toss",
  "simon_says",
] as const;

export const TICKETED_GAME_TYPES = [
  ...CLASSIC_TICKETED_GAME_TYPES,
  ...ARCADE_GAME_TYPES,
] as const;
export const GAME_TYPES = [...TICKETED_GAME_TYPES, "mystery_box"] as const;

export type ArcadeGameType = (typeof ARCADE_GAME_TYPES)[number];

// Shared reward ladder (same numbers as puzzle.ts's scoreForAccuracy tiers) -
// every arcade game maps its own raw score through this via per-game
// thresholds, so ticket EV stays consistent across the whole ticketed-game
// pool instead of drifting per game. roundDurationMs + maxRawScore back the
// submit-time plausibility clamp (a sanity bound, not real anti-cheat - see
// arcade.ts).
export const ARCADE_REWARD_LADDER = {
  bronze: 1_000,
  silver: 3_000,
  gold: 5_000,
  perfect: 10_000,
} as const;

export type ArcadeGameConfig = {
  roundDurationMs: number;
  maxRawScore: number;
  thresholds: { bronze: number; silver: number; gold: number; perfect: number };
};

export const ARCADE_GAMES: Record<ArcadeGameType, ArcadeGameConfig> = {
  // Lives-based, not a pure fixed-round timer: 3 hearts, lose one whenever a
  // falling problem reaches the floor unanswered, game ends at 0 hearts.
  // roundDurationMs here is just the overall safety-net cap (see arcade.ts's
  // submit-time clamp), not the normal end condition.
  quick_math: {
    roundDurationMs: 90_000,
    maxRawScore: 60,
    thresholds: { bronze: 5, silver: 10, gold: 18, perfect: 28 },
  },
  whack_a_mole: {
    roundDurationMs: 30_000,
    maxRawScore: 100,
    thresholds: { bronze: 10, silver: 20, gold: 30, perfect: 45 },
  },
  flappy_runner: {
    roundDurationMs: 120_000,
    maxRawScore: 500,
    thresholds: { bronze: 5, silver: 15, gold: 30, perfect: 60 },
  },
  merge_2048: {
    roundDurationMs: 300_000,
    maxRawScore: 4_096,
    thresholds: { bronze: 64, silver: 256, gold: 512, perfect: 1_024 },
  },
  memory_match: {
    roundDurationMs: 120_000,
    maxRawScore: 100,
    thresholds: { bronze: 40, silver: 60, gold: 80, perfect: 95 },
  },
  stack_tower: {
    roundDurationMs: 120_000,
    maxRawScore: 100,
    thresholds: { bronze: 8, silver: 16, gold: 28, perfect: 45 },
  },
  color_switch: {
    roundDurationMs: 120_000,
    maxRawScore: 100,
    thresholds: { bronze: 8, silver: 18, gold: 30, perfect: 50 },
  },
  slingshot_toss: {
    roundDurationMs: 30_000,
    maxRawScore: 100,
    thresholds: { bronze: 50, silver: 70, gold: 88, perfect: 98 },
  },
  simon_says: {
    roundDurationMs: 120_000,
    maxRawScore: 30,
    thresholds: { bronze: 5, silver: 8, gold: 12, perfect: 16 },
  },
};

export const minigameStartSchema = z.object({
  playToken: z.string().uuid(),
});

export const arcadeSubmitSchema = z.object({
  playToken: z.string().uuid(),
  rawScore: z.number().finite().min(0).optional(),
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
