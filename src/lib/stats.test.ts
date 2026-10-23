/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { batAvg, createSeasonStats, emptyGameLine, era, mergeGameStats } from "./stats";

describe("시즌 성적 누적", () => {
  test("두 경기의 타격 기록이 누적된다", () => {
    let s = createSeasonStats();
    s = mergeGameStats(s, "LG", { ...emptyGameLine(), batting: { 김현수: { pa: 4, ab: 4, h: 2, rbi: 1 } } });
    s = mergeGameStats(s, "LG", { ...emptyGameLine(), batting: { 김현수: { pa: 4, ab: 3, h: 1, hr: 1, rbi: 2, bb: 1 } } });
    const st = s.LG!.batters["김현수"]!;
    expect(st.pa).toBe(8);
    expect(st.ab).toBe(7);
    expect(st.h).toBe(3);
    expect(st.hr).toBe(1);
    expect(st.rbi).toBe(3);
    expect(st.bb).toBe(1);
  });
  test("병합해도 원본 시즌 데이터가 바뀌지 않는다", () => {
    const s = mergeGameStats(createSeasonStats(), "LG", { ...emptyGameLine(), batting: { 김현수: { pa: 1, ab: 1, h: 1 } } });
    mergeGameStats(s, "LG", { ...emptyGameLine(), batting: { 김현수: { pa: 3, ab: 3, h: 2 } } });
    expect(s.LG!.batters["김현수"]!.h).toBe(1);
  });
  test("타율은 안타/타수, 타수 0이면 0", () => {
    expect(batAvg({ pa: 4, ab: 4, h: 2, hr: 0, rbi: 0, bb: 0, so: 0 })).toBe(0.5);
    expect(batAvg({ pa: 2, ab: 0, h: 0, hr: 0, rbi: 0, bb: 2, so: 0 })).toBe(0);
  });
  test("방어율은 9이닝 환산 (3이닝 1실점 = 3.00)", () => {
    expect(era({ outs: 9, er: 1, w: 0, l: 0, hld: 0, sv: 0 })).toBeCloseTo(3.0);
    expect(era({ outs: 0, er: 0, w: 0, l: 0, hld: 0, sv: 0 })).toBe(0);
  });
  test("투수 승·패·홀드·세이브가 누적된다", () => {
    let s = createSeasonStats();
    s = mergeGameStats(s, "SS", { ...emptyGameLine(), pitching: { 원태인: { outs: 18, er: 2, w: 1 } } });
    s = mergeGameStats(s, "SS", { ...emptyGameLine(), pitching: { 원태인: { outs: 21, er: 1, w: 1 }, 오승환: { outs: 3, er: 0, sv: 1 } } });
    expect(s.SS!.pitchers["원태인"]!.w).toBe(2);
    expect(s.SS!.pitchers["원태인"]!.outs).toBe(39);
    expect(s.SS!.pitchers["오승환"]!.sv).toBe(1);
  });
});
