import { describe, expect, test } from "bun:test";
import { seasonAwards, settleSeason } from "./awards";
import { createLeague, SEASON_OPTIONS } from "./league";

describe("시즌 정산", () => {
  test("1위 5000만$, 우승 보너스 3000만$, 타이틀 1개당 500만$", () => {
    const awards = [{ title: "홈런왕", team: "b", name: "x", detail: "" }];
    const r = settleSeason({ a: 0, b: 0, c: 0 }, ["a", "b", "c"], "b", awards, (id) => id);
    expect(r.money.a).toBe(5000);
    expect(r.money.b).toBe(3500 + 3000 + 500);
    expect(r.money.c).toBe(2500);
  });
  test("타율 타이틀은 규정 타석(최다의 절반) 미달 선수를 제외한다", () => {
    const awards = seasonAwards({
      a: { batters: { 많이: { pa: 40, ab: 40, h: 12, hr: 0, rbi: 0, bb: 0, so: 0 }, 적게: { pa: 4, ab: 4, h: 4, hr: 0, rbi: 0, bb: 0, so: 0 } }, pitchers: {} },
    });
    expect(awards.find((a) => a.title === "타격왕")?.name).toBe("많이");
  });
});

describe("시즌 길이", () => {
  test("144경기 시즌은 팀당 144경기를 치른다", () => {
    const opt = SEASON_OPTIONS.find((o) => o.games === 144)!;
    const L = createLeague("lg", 3, 0, opt.cycles);
    const n = L.schedule.filter((g) => g.home === "lg" || g.away === "lg").length;
    expect(n).toBe(144);
    expect(L.cycles).toBe(opt.cycles);
  });
});
