import { describe, expect, test } from "bun:test";
import { scoreForAccuracy } from "./puzzle";

describe("scoreForAccuracy", () => {
  test("uses stable reward boundaries", () => {
    expect(scoreForAccuracy(100)).toBe(1000);
    expect(scoreForAccuracy(90)).toBe(500);
    expect(scoreForAccuracy(70)).toBe(300);
    expect(scoreForAccuracy(50)).toBe(100);
    expect(scoreForAccuracy(49.99)).toBe(0);
  });
});
