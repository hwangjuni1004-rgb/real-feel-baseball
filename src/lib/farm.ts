// 1군/2군 로스터 도메인 (브라우저 안전, UI와 분리해 테스트 가능)
import { TEAMS, batterValue, pitcherValue, type Batter, type Pitcher } from "./kbo-data";
import { MIN_BATTERS, MIN_PITCHERS, type MarketState } from "./market";

/** 1군 등록 한도 (KBO 1군 엔트리 28명 기준: 타자 15 + 투수 13) */
export const MAX_BATTERS_1 = 15;
export const MAX_PITCHERS_1 = 13;
/** 2군으로 내려간 선수는 이 경기 수가 지나야 다시 올릴 수 있다 (KBO 10일 규정 축소판) */
export const RECALL_WAIT = 3;
/** 2군 선수가 한 경기마다 능력치 1 오를 확률 */
export const GROWTH_CHANCE = 0.04;

export type FarmEntry<T> = { player: T; since: number };
export type Farm = { batters: FarmEntry<Batter>[]; pitchers: FarmEntry<Pitcher>[] };
export type Kind = "B" | "P";
type Result = { ok: true; market: MarketState; message: string } | { ok: false; error: string };

const short = (id: string) => TEAMS.find((t) => t.id === id)?.short ?? id;
export const getFarm = (m: MarketState, team: string): Farm => m.farm?.[team] ?? { batters: [], pitchers: [] };
const withFarm = (m: MarketState, team: string, f: Farm): MarketState => ({ ...m, farm: { ...(m.farm ?? {}), [team]: f } });

export function recallIn(m: MarketState, e: FarmEntry<unknown>) {
  return Math.max(0, e.since + RECALL_WAIT - m.gameNo);
}

export function demote(m: MarketState, team: string, kind: Kind, name: string): Result {
  const r = m.rosters[team];
  if (!r) return { ok: false, error: "구단을 찾을 수 없습니다." };
  const f = getFarm(m, team);
  if (kind === "B") {
    const p = r.lineup.find((b) => b.name === name);
    if (!p) return { ok: false, error: "1군에 없는 선수입니다." };
    if (r.lineup.length <= MIN_BATTERS) return { ok: false, error: `1군 타자는 최소 ${MIN_BATTERS}명이 필요합니다.` };
    const market = withFarm({ ...m, rosters: { ...m.rosters, [team]: { ...r, lineup: r.lineup.filter((b) => b.name !== name) } } }, team,
      { ...f, batters: [...f.batters, { player: p, since: m.gameNo }] });
    return { ok: true, market, message: `${name} 2군 강등` };
  }
  const p = r.rotation.find((x) => x.name === name);
  if (!p) return { ok: false, error: "1군에 없는 선수입니다." };
  if (r.rotation.length <= MIN_PITCHERS) return { ok: false, error: `1군 투수는 최소 ${MIN_PITCHERS}명이 필요합니다.` };
  const market = withFarm({ ...m, rosters: { ...m.rosters, [team]: { ...r, rotation: r.rotation.filter((x) => x.name !== name) } } }, team,
    { ...f, pitchers: [...f.pitchers, { player: p, since: m.gameNo }] });
  return { ok: true, market, message: `${name} 2군 강등` };
}

export function promote(m: MarketState, team: string, kind: Kind, name: string): Result {
  const r = m.rosters[team];
  if (!r) return { ok: false, error: "구단을 찾을 수 없습니다." };
  const f = getFarm(m, team);
  const list = kind === "B" ? f.batters : f.pitchers;
  const e = list.find((x) => x.player.name === name);
  if (!e) return { ok: false, error: "2군에 없는 선수입니다." };
  const wait = recallIn(m, e);
  if (wait > 0) return { ok: false, error: `${wait}경기 뒤에 다시 올릴 수 있습니다.` };
  if (kind === "B" && r.lineup.length >= MAX_BATTERS_1) return { ok: false, error: `1군 타자가 꽉 찼습니다 (${MAX_BATTERS_1}명). 먼저 한 명을 내려주세요.` };
  if (kind === "P" && r.rotation.length >= MAX_PITCHERS_1) return { ok: false, error: `1군 투수가 꽉 찼습니다 (${MAX_PITCHERS_1}명). 먼저 한 명을 내려주세요.` };
  const roster = kind === "B" ? { ...r, lineup: [...r.lineup, e.player as Batter] } : { ...r, rotation: [...r.rotation, e.player as Pitcher] };
  const nf = kind === "B" ? { ...f, batters: f.batters.filter((x) => x !== e) } : { ...f, pitchers: f.pitchers.filter((x) => x !== e) };
  return { ok: true, market: withFarm({ ...m, rosters: { ...m.rosters, [team]: roster } }, team, nf), message: `${name} 1군 콜업` };
}

/**
 * 1군 한도 초과분을 2군으로 보낸다. 주전(앞 9명 타자/앞 5명 투수)과 protect 이름은 남기고
 * 나머지 중 가치가 낮은 선수부터 내린다.
 */
export function enforceLimits(m: MarketState, user: string, protect: string[] = []): MarketState {
  let out = m;
  const news: string[] = [];
  for (const t of TEAMS) {
    const r = out.rosters[t.id];
    if (!r) continue;
    const keep = new Set([...r.lineup.slice(0, 9).map((b) => b.name), ...r.rotation.slice(0, 5).map((p) => p.name), ...(t.id === user ? protect : [])]);
    const extraB = r.lineup.length - MAX_BATTERS_1;
    const extraP = r.rotation.length - MAX_PITCHERS_1;
    const dropB = extraB > 0 ? r.lineup.filter((b) => !keep.has(b.name)).sort((a, b) => batterValue(a) - batterValue(b)).slice(0, extraB) : [];
    const dropP = extraP > 0 ? r.rotation.filter((p) => !keep.has(p.name)).sort((a, b) => pitcherValue(a) - pitcherValue(b)).slice(0, extraP) : [];
    if (!dropB.length && !dropP.length) continue;
    const f = getFarm(out, t.id);
    const db = new Set(dropB.map((b) => b.name));
    const dp = new Set(dropP.map((p) => p.name));
    out = withFarm({ ...out, rosters: { ...out.rosters, [t.id]: { lineup: r.lineup.filter((b) => !db.has(b.name)), rotation: r.rotation.filter((p) => !dp.has(p.name)) } } }, t.id, {
      batters: [...f.batters, ...dropB.map((p) => ({ player: p, since: out.gameNo }))],
      pitchers: [...f.pitchers, ...dropP.map((p) => ({ player: p, since: out.gameNo }))],
    });
    if (t.id === user) news.push(`⬇️ 1군 엔트리 초과 — ${[...dropB, ...dropP].map((p) => p.name).join(", ")} 2군행`);
  }
  return news.length ? { ...out, news: [...news, ...out.news].slice(0, 60) } : out;
}

/** 경기마다 2군 선수 성장 + CPU 콜업/강등 + 한도 정리 */
export function farmTick(m0: MarketState, user: string, protect: string[] = [], random: () => number = Math.random): MarketState {
  const farm: Record<string, Farm> = {};
  const news: string[] = [];
  for (const [team, f] of Object.entries(m0.farm ?? {})) {
    const grow = <T extends Batter | Pitcher>(e: FarmEntry<T>): FarmEntry<T> => {
      if (random() >= GROWTH_CHANCE) return e;
      if ("pos" in e.player) {
        const b = e.player as Batter;
        const key = b.contact <= b.power ? "contact" : "power";
        if (b[key] >= 10) return e;
        if (team === user) news.push(`📈 2군 ${b.name} ${key === "contact" ? "정확" : "파워"} +1`);
        return { ...e, player: { ...b, [key]: b[key] + 1 } as T };
      }
      const p = e.player as Pitcher;
      if (p.control >= 10) return e;
      if (team === user) news.push(`📈 2군 ${p.name} 제구 +1`);
      return { ...e, player: { ...p, control: p.control + 1 } as T };
    };
    farm[team] = { batters: f.batters.map(grow), pitchers: f.pitchers.map(grow) };
  }
  let m: MarketState = { ...m0, farm, news: news.length ? [...news, ...m0.news].slice(0, 60) : m0.news };
  // CPU: 1군 자리가 비고 콜업 가능한 2군 선수가 있으면 가장 좋은 선수를 올린다
  for (const t of TEAMS) {
    if (t.id === user) continue;
    const f = getFarm(m, t.id);
    const r = m.rosters[t.id];
    if (!r) continue;
    const bestB = f.batters.filter((e) => recallIn(m, e) === 0).sort((a, b) => batterValue(b.player) - batterValue(a.player))[0];
    if (bestB && r.lineup.length < MAX_BATTERS_1) { const res = promote(m, t.id, "B", bestB.player.name); if (res.ok) m = res.market; }
    const bestP = f.pitchers.filter((e) => recallIn(m, e) === 0).sort((a, b) => pitcherValue(b.player) - pitcherValue(a.player))[0];
    const r2 = m.rosters[t.id]!;
    if (bestP && r2.rotation.length < MAX_PITCHERS_1) { const res = promote(m, t.id, "P", bestP.player.name); if (res.ok) m = res.market; }
  }
  return enforceLimits(m, user, protect);
}
