import { describe, expect, test } from "bun:test";
import { startOfBangkokDay } from "./mystery-box";

describe("startOfBangkokDay", () => {
  test("resets at midnight in Asia/Bangkok", () => {
    const now = new Date("2026-07-26T18:30:00.000Z");
    expect(startOfBangkokDay(now).toISOString()).toBe(
      "2026-07-26T17:00:00.000Z",
    );
  });
});
