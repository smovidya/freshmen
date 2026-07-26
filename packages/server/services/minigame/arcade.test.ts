import { describe, expect, test } from "bun:test";
import {
  ARCADE_GAMES,
  ARCADE_GAME_TYPES,
  ARCADE_REWARD_LADDER,
} from "@vidyafreshmen/dto";
import { scoreToPoints } from "./arcade";

describe("scoreToPoints", () => {
  test("every arcade game maps its own thresholds onto the shared ladder", () => {
    for (const gameType of ARCADE_GAME_TYPES) {
      const { thresholds } = ARCADE_GAMES[gameType];
      expect(scoreToPoints(gameType, 0)).toBe(0);
      expect(scoreToPoints(gameType, thresholds.bronze - 1)).toBe(0);
      expect(scoreToPoints(gameType, thresholds.bronze)).toBe(
        ARCADE_REWARD_LADDER.bronze,
      );
      expect(scoreToPoints(gameType, thresholds.silver)).toBe(
        ARCADE_REWARD_LADDER.silver,
      );
      expect(scoreToPoints(gameType, thresholds.gold)).toBe(
        ARCADE_REWARD_LADDER.gold,
      );
      expect(scoreToPoints(gameType, thresholds.perfect)).toBe(
        ARCADE_REWARD_LADDER.perfect,
      );
      // Above perfect never scores more than the top tier.
      expect(scoreToPoints(gameType, thresholds.perfect + 1_000)).toBe(
        ARCADE_REWARD_LADDER.perfect,
      );
    }
  });

  test("threshold tiers are strictly increasing per game (no unreachable/overlapping tier)", () => {
    for (const gameType of ARCADE_GAME_TYPES) {
      const { bronze, silver, gold, perfect } =
        ARCADE_GAMES[gameType].thresholds;
      expect(bronze).toBeLessThan(silver);
      expect(silver).toBeLessThan(gold);
      expect(gold).toBeLessThan(perfect);
    }
  });

  test("maxRawScore is at least the perfect threshold, so a perfect play is never clamped away", () => {
    for (const gameType of ARCADE_GAME_TYPES) {
      const { maxRawScore, thresholds } = ARCADE_GAMES[gameType];
      expect(maxRawScore).toBeGreaterThanOrEqual(thresholds.perfect);
    }
  });
});
