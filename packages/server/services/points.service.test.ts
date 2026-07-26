import { describe, expect, test } from "bun:test";
import { isBuffEligibleSource } from "./points.service";

describe("isBuffEligibleSource", () => {
  // Score-inflation regression guard: the active-buff multiplier must only
  // ever touch shake pops. Fixed-value rewards (minigames, referrals, free
  // claims, refunds) must always credit their base amount - multiplying them
  // is what produced the 50,000-point ledger rows during the uncapped-x100
  // era.
  test("applies to shake_pop only", () => {
    expect(isBuffEligibleSource("shake_pop")).toBe(true);
  });

  test("excludes every fixed-value credit source", () => {
    expect(isBuffEligibleSource("minigame:puzzle")).toBe(false);
    expect(isBuffEligibleSource("minigame:precision")).toBe(false);
    expect(isBuffEligibleSource("minigame:wheel")).toBe(false);
    expect(isBuffEligibleSource("minigame:wheel:buff-conversion")).toBe(false);
    expect(isBuffEligibleSource("friend_referral")).toBe(false);
    expect(isBuffEligibleSource("free_claim")).toBe(false);
    expect(isBuffEligibleSource("shop_refund")).toBe(false);
  });
});
