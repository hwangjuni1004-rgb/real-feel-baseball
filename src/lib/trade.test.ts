import { describe, expect, test } from "bun:test";
import { TEAMS } from "./kbo-data";
import { type MarketState } from "./market";
import { evaluateTrade, proposeTrade, tradePlayers, tradeValue, type TradeProposal } from "./trade";

function fixture(): MarketState {
  return { gameNo: 0, money: Object.fromEntries(TEAMS.map((t) => [t.id, 20000])),
    rosters: Object.fromEntries(TEAMS.map((t) => [t.id, { lineup: [...t.lineup], rotation: [...t.rotation] }])), listings: [], news: [] };
}
function proposal(m: MarketState): TradeProposal {
  const own = m.rosters.kia.lineup[0];
  const other = m.rosters.lg.lineup[0];
  if (!own || !other) throw new Error("Missing players");
  return { user: "kia", other: "lg", give: { kind: "B", name: own.name }, receive: { kind: "B", name: other.name } };
}
describe("트레이드", () => {
  test("상대에게 더 높은 가치의 선수를 주면 수락 확률이 높다", () => {
    const m = fixture(); const p = proposal(m);
    const players = tradePlayers(m.rosters.kia).filter((x) => x.kind === "B").sort((a, b) => tradeValue(m.rosters.kia, a) - tradeValue(m.rosters.kia, b));
    const weak = players[0]; const strong = players[players.length - 1];
    if (!weak || !strong) throw new Error("Missing players");
    expect(evaluateTrade(m, { ...p, give: strong }).probability).toBeGreaterThan(evaluateTrade(m, { ...p, give: weak }).probability);
  });
  test("성사 시 선수는 양방향으로 이동하고 자금은 변하지 않는다", () => {
    const m = fixture(); const p = proposal(m); const next = proposeTrade(m, p, () => 0);
    expect(next.accepted).toBe(true);
    expect(next.market.rosters.kia.lineup.some((x) => x.name === p.give.name)).toBe(false);
    expect(next.market.rosters.lg.lineup.some((x) => x.name === p.give.name)).toBe(true);
    expect(next.market.rosters.kia.lineup.some((x) => x.name === p.receive.name)).toBe(true);
    expect(next.market.rosters.lg.lineup.some((x) => x.name === p.receive.name)).toBe(false);
    expect(next.market.money).toEqual(m.money);
    expect(m.rosters.kia.lineup.some((x) => x.name === p.give.name)).toBe(true);
  });
  test("거절 시 소속을 유지한다", () => {
    const m = fixture(); const next = proposeTrade(m, proposal(m), () => 0.999);
    expect(next.accepted).toBe(false); expect(next.market.rosters).toEqual(m.rosters);
  });
  test("최소 타자 9명·투수 5명을 지킨다", () => {
    const m = fixture(); const p = proposal(m);
    m.rosters.kia.lineup = m.rosters.kia.lineup.slice(0, 9);
    const pitcher = m.rosters.lg.rotation[0]; if (!pitcher) throw new Error("Missing pitcher");
    expect(evaluateTrade(m, { ...p, receive: { kind: "P", name: pitcher.name } }).valid).toBe(false);
    m.rosters.kia.rotation = m.rosters.kia.rotation.slice(0, 5);
    const ownPitcher = m.rosters.kia.rotation[0]; if (!ownPitcher) throw new Error("Missing pitcher");
    expect(evaluateTrade(m, { ...p, give: { kind: "P", name: ownPitcher.name } }).valid).toBe(false);
  });
  test("교환된 선수의 미체결 매물을 제거한다", () => {
    const m = fixture(); const p = proposal(m);
    m.listings = [{ id: "old", kind: "B", from: "kia", batter: m.rosters.kia.lineup[0], value: 100, closesAt: 3, bids: [] }];
    expect(proposeTrade(m, p, () => 0).market.listings).toHaveLength(0);
  });
});