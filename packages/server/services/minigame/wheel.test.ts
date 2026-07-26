import { describe, expect, test } from "bun:test";
import { WHEEL_OUTCOMES } from "@vidyafreshmen/dto";
import { pointsForOutcome, WHEEL_WEIGHTS } from "./wheel";

describe("wheel configuration", () => {
  test("keeps the shared visual and server weights at 100 percent", () => {
    expect(
      Object.values(WHEEL_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
    ).toBe(100);
    expect(WHEEL_OUTCOMES.map(({ key }) => key).join(",")).toBe(
      Object.keys(WHEEL_WEIGHTS).join(","),
    );
  });

  test("maps point slices to their advertised reward", () => {
    expect(pointsForOutcome("pts_100")).toBe(1_000);
    expect(pointsForOutcome("pts_1000")).toBe(10_000);
    expect(pointsForOutcome("buff_x100")).toBe(0);
  });
});
