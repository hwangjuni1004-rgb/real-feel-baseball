/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { TEAMS, defenseOutBoost, teamDefense } from "./kbo-data";

describe("수비력 타구 판정 보정", () => {
  test("평균 수비력(5.5)이면 보정 0", () => {
    expect(defenseOutBoost(5.5)).toBe(0);
  });
  test("수비력 10이면 최대 +0.09 (안타성 타구 9%p 아웃 전환)", () => {
    expect(defenseOutBoost(10)).toBeCloseTo(0.09);
  });
  test("수비력 1이면 최소 -0.05 (아웃성 타구 5%p 안타 전환)", () => {
    expect(defenseOutBoost(1)).toBeCloseTo(-0.05);
  });
  test("모든 팀의 평균 수비력은 1~10 사이", () => {
    for (const t of TEAMS) {
      const d = teamDefense(t);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(10);
    }
  });
});
