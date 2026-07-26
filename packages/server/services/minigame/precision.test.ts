import { describe, expect, test } from "bun:test";
import { RHYTHM_CONFIG, scoreRhythmTaps } from "./precision";

const targets = Array.from(
  { length: RHYTHM_CONFIG.scoringBeats },
  (_, index) =>
    (RHYTHM_CONFIG.countInBeats + index) * RHYTHM_CONFIG.beatIntervalMs,
);

describe("scoreRhythmTaps", () => {
  test("awards the full score for taps on every beat", () => {
    expect(scoreRhythmTaps(targets)).toEqual({
      points: 6_000,
      perfect: 8,
      great: 0,
      good: 0,
      misses: 0,
      averageOffsetMs: 0,
    });
  });

  test("grades from one local metronome clock", () => {
    const result = scoreRhythmTaps(targets.map((target) => target + 80));
    expect(result.points).toBe(4_000);
    expect(result.great).toBe(8);
    expect(result.misses).toBe(0);
    expect(result.averageOffsetMs).toBe(80);
  });

  test("does not reuse one tap for adjacent beats", () => {
    const result = scoreRhythmTaps([targets[0]!]);
    expect(result.perfect).toBe(1);
    expect(result.misses).toBe(7);
  });
});
