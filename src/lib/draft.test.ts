import { describe, expect, test } from "bun:test";
import { createDraft, cpuPicksUntilUser, makePick, available, applyDraft, onClock } from "./draft";
import { createMarket } from "./market";

const rank = ["a", "b", "c"].map((id) => ({ id, w: 0, l: 0, d: 0, rs: 0, ra: 0 }));

describe("신인 드래프트", () => {
  test("최종 순위 역순으로 지명한다", () => {
    expect(createDraft(rank).order).toEqual(["c", "b", "a"]);
  });
  test("CPU는 유저 차례에서 멈추고 유저가 고른 선수가 기록된다", () => {
    let d = cpuPicksUntilUser(createDraft(rank, 2), "a");
    expect(d.picks.length).toBe(2);
    expect(onClock(d)).toBe("a");
    const id = available(d)[3]!.id;
    d = makePick(d, id);
    expect(d.picks[2]).toEqual({ round: 1, team: "a", prospectId: id });
    expect(onClock(d)).toBe("c");
  });
  test("지명 선수는 해당 팀 로스터에 합류한다", () => {
    const m = createMarket("lg");
    const order = Object.keys(m.rosters).map((id) => ({ id, w: 0, l: 0, d: 0, rs: 0, ra: 0 }));
    const d = cpuPicksUntilUser(createDraft(order, 1), "none");
    const before = m.rosters[d.order[0]!]!;
    const after = applyDraft(m, d).market.rosters[d.order[0]!]!;
    expect(after.lineup.length + after.rotation.length).toBe(before.lineup.length + before.rotation.length + 1);
  });
});
