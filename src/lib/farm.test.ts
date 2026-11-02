import { describe, expect, test } from "bun:test";
import { createMarket } from "./market";
import { demote, promote, enforceLimits, farmTick, getFarm, MAX_BATTERS_1, MAX_PITCHERS_1, RECALL_WAIT } from "./farm";

describe("1군/2군", () => {
  test("1군은 타자 15명·투수 13명을 넘지 않는다 (LG 투수 26명 → 13명)", () => {
    const m = enforceLimits(createMarket("lg"), "lg");
    expect(m.rosters.lg!.rotation.length).toBe(MAX_PITCHERS_1);
    expect(getFarm(m, "lg").pitchers.length).toBe(13);
    for (const r of Object.values(m.rosters)) {
      expect(r.lineup.length).toBeLessThanOrEqual(MAX_BATTERS_1);
      expect(r.rotation.length).toBeLessThanOrEqual(MAX_PITCHERS_1);
    }
  });
  test("선발 5명은 한도 정리로 내려가지 않는다", () => {
    const m0 = createMarket("lg");
    const starters = m0.rosters.lg!.rotation.slice(0, 5).map((p) => p.name);
    const m = enforceLimits(m0, "lg");
    expect(m.rosters.lg!.rotation.slice(0, 5).map((p) => p.name)).toEqual(starters);
  });
  test("강등된 선수는 3경기가 지나야 콜업된다", () => {
    const m0 = enforceLimits(createMarket("kia"), "kia");
    const name = m0.rosters.kia!.lineup[11]!.name;
    const d = demote(m0, "kia", "B", name);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(promote(d.market, "kia", "B", name).ok).toBe(false);
    const later = { ...d.market, gameNo: d.market.gameNo + RECALL_WAIT };
    const p = promote(later, "kia", "B", name);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.market.rosters.kia!.lineup.some((b) => b.name === name)).toBe(true);
  });
  test("1군 타자는 9명 아래로 내릴 수 없다", () => {
    let m = createMarket("hanwha");
    const names = m.rosters.hanwha!.lineup.map((b) => b.name);
    for (const n of names.slice(9)) { const r = demote(m, "hanwha", "B", n); if (r.ok) m = r.market; }
    expect(m.rosters.hanwha!.lineup.length).toBe(9);
    expect(demote(m, "hanwha", "B", names[0]!).ok).toBe(false);
  });
  test("2군 선수는 경기마다 성장할 수 있다", () => {
    const m0 = enforceLimits(createMarket("lg"), "lg");
    const before = getFarm(m0, "lg").pitchers[0]!.player;
    const m = farmTick(m0, "lg", [], () => 0);
    const after = getFarm(m, "lg").pitchers.find((e) => e.player.name === before.name)!.player;
    expect(after.control).toBe(Math.min(10, before.control + (before.control < 10 ? 1 : 0)));
  });
});
