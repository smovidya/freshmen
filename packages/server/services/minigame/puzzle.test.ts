import { describe, expect, test } from "bun:test";
import { PUZZLE_MIN_PLAY_MS, scoreForAccuracy } from "./puzzle";

describe("scoreForAccuracy", () => {
  test("uses stable reward boundaries", () => {
    expect(scoreForAccuracy(100)).toBe(1000);
    expect(scoreForAccuracy(90)).toBe(500);
    expect(scoreForAccuracy(70)).toBe(300);
    expect(scoreForAccuracy(50)).toBe(100);
    expect(scoreForAccuracy(49.99)).toBe(0);
  });
});

describe("PUZZLE_MIN_PLAY_MS", () => {
  // Bot guard (see submit() in puzzle.ts): rejects grading a play submitted
  // faster than a human could plausibly align and drag. Regression guard so
  // this can't silently regress to 0/disabled.
  test("requires a plausible minimum human play time", () => {
    expect(PUZZLE_MIN_PLAY_MS).toBeGreaterThanOrEqual(1_000);
  });
});
