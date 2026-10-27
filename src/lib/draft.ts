import { batterValue, pitcherValue, type Batter, type Pitcher, type Position } from "./kbo-data";
import type { Standing } from "./league";
import type { MarketState } from "./market";

// 신인 드래프트: 전 시즌 최종 순위 역순으로 지명 (꼴찌가 1순위)
export type Prospect = { id: string; kind: "B" | "P"; batter?: Batter; pitcher?: Pitcher; value: number };
export type DraftPick = { round: number; team: string; prospectId: string };
export type DraftState = { order: string[]; rounds: number; pool: Prospect[]; picks: DraftPick[] };

const SUR = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황"];
const GIV = ["민준", "서준", "도윤", "예준", "시우", "하준", "주원", "지호", "준서", "건우", "현우", "우진", "선우", "유찬", "태윤", "은호", "재민", "동현"];
const POS: Position[] = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export const draftOrder = (finalRank: Standing[]) => [...finalRank].reverse().map((s) => s.id);

export function createDraft(finalRank: Standing[], rounds = 2, random: () => number = Math.random): DraftState {
  const order = draftOrder(finalRank);
  const r = (a: number, b: number) => a + Math.floor(random() * (b - a + 1));
  const used = new Set<string>();
  const name = () => {
    for (;;) { const n = SUR[r(0, SUR.length - 1)]! + GIV[r(0, GIV.length - 1)]!; if (!used.has(n)) { used.add(n); return n; } }
  };
  const pool: Prospect[] = [];
  const size = order.length * rounds + 6;
  for (let i = 0; i < size; i++) {
    if (i % 2 === 0) {
      const v = r(141, 155);
      const pitcher: Pitcher = {
        name: name(), throws: random() < 0.3 ? "L" : "R", velo: v, control: r(3, 7), slot: "over",
        pitches: [
          { name: "포심 패스트볼", speedMin: v - 3, speedMax: v, break: { x: 0, y: -0.2 } },
          { name: "슬라이더", speedMin: v - 14, speedMax: v - 5, break: { x: -1.9, y: 0.9 } },
          { name: "체인지업", speedMin: v - 17, speedMax: v - 7, break: { x: 0.9, y: 1.7 } },
        ],
      };
      pool.push({ id: `p${i}`, kind: "P", pitcher, value: pitcherValue(pitcher) });
    } else {
      const batter: Batter = { name: name(), pos: POS[r(0, POS.length - 1)]!, bats: random() < 0.35 ? "L" : "R", power: r(2, 7), contact: r(3, 7), speed: r(3, 8), defense: r(3, 8) };
      pool.push({ id: `p${i}`, kind: "B", batter, value: batterValue(batter) });
    }
  }
  pool.sort((a, b) => b.value - a.value);
  return { order, rounds, pool, picks: [] };
}

export const draftDone = (d: DraftState) => d.picks.length >= d.order.length * d.rounds;
export const onClock = (d: DraftState) => (draftDone(d) ? null : d.order[d.picks.length % d.order.length]!);
export const available = (d: DraftState) => d.pool.filter((p) => !d.picks.some((k) => k.prospectId === p.id));

export function makePick(d: DraftState, prospectId: string): DraftState {
  const team = onClock(d);
  if (!team || !available(d).some((p) => p.id === prospectId)) return d;
  return { ...d, picks: [...d.picks, { round: Math.floor(d.picks.length / d.order.length) + 1, team, prospectId }] };
}

/** CPU 팀은 가장 가치 높은 선수를 지명하며, 유저 차례에서 멈춘다 */
export function cpuPicksUntilUser(d: DraftState, user: string): DraftState {
  let s = d;
  while (!draftDone(s) && onClock(s) !== user) s = makePick(s, available(s)[0]!.id);
  return s;
}

/** 지명 선수를 각 팀 로스터에 추가 */
export function applyDraft(m: MarketState, d: DraftState): { market: MarketState; news: string[] } {
  const rosters = structuredClone(m.rosters);
  const news: string[] = [];
  d.picks.forEach((k, i) => {
    const p = d.pool.find((x) => x.id === k.prospectId)!;
    const r = rosters[k.team];
    if (!r) return;
    if (p.batter) r.lineup.push(p.batter); else if (p.pitcher) r.rotation.push(p.pitcher);
    news.push(`🎓 드래프트 ${k.round}라운드 ${(i % d.order.length) + 1}순위: ${k.team} — ${(p.batter ?? p.pitcher)!.name}`);
  });
  return { market: { ...m, rosters, news: [...news.reverse(), ...m.news].slice(0, 60) }, news };
}
