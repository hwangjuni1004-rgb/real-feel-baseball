// 이적시장: 랜덤 매물, 자유 오퍼, 몇 경기 후 체결, 경합 시 금액 기반 확률
import { TEAMS, batterValue, pitcherValue, fmtMoney, type Batter, type Pitcher, type Team, type PitchType } from "./kbo-data";

export type Roster = { lineup: Batter[]; rotation: Pitcher[] };
export type Bid = { team: string; amount: number };
export type Listing = {
  id: string;
  kind: "B" | "P";
  batter?: Batter;
  pitcher?: Pitcher;
  from: string; // 팀 id, 또는 "MLB"(자유계약)
  value: number;
  closesAt: number; // 이 경기 수 이후 체결
  bids: Bid[];
  userListed?: boolean; // 내가 올린 매물
  direct?: boolean; // 타팀 선수 직접 오퍼
};
export type MarketState = {
  gameNo: number;
  money: Record<string, number>;
  rosters: Record<string, Roster>;
  listings: Listing[];
  news: string[];
};

export const MIN_BATTERS = 9;
export const MIN_PITCHERS = 5;
const WAIT = 3; // 체결까지 경기 수

const P = (name: string, a: number, b: number, x: number, y: number): PitchType => ({ name, speedMin: a, speedMax: b, break: { x, y } });
const MLB_BATTERS: Batter[] = [
  { name: "오타니 쇼헤이", pos: "DH", bats: "L", power: 10, contact: 9, speed: 8, defense: 5, nickname: "쇼타임", legend: true },
  { name: "애런 저지", pos: "RF", bats: "R", power: 10, contact: 8, speed: 5, defense: 7, legend: true },
  { name: "마이크 트라웃", pos: "CF", bats: "R", power: 9, contact: 9, speed: 7, defense: 8, legend: true },
  { name: "후안 소토", pos: "LF", bats: "L", power: 9, contact: 10, speed: 5, defense: 6, legend: true },
  { name: "배리 본즈", pos: "LF", bats: "L", power: 10, contact: 10, speed: 7, defense: 7, nickname: "홈런왕", legend: true },
  { name: "켄 그리피 주니어", pos: "CF", bats: "L", power: 9, contact: 9, speed: 7, defense: 10, nickname: "더 키드", legend: true },
  { name: "이치로", pos: "RF", bats: "L", power: 4, contact: 10, speed: 10, defense: 10, legend: true },
  { name: "추신수", pos: "RF", bats: "L", power: 7, contact: 8, speed: 7, defense: 6, nickname: "추추트레인", legend: true },
];
const MLB_PITCHERS: Pitcher[] = [
  { name: "게릿 콜", throws: "R", velo: 159, control: 8, legend: true, sig: "슬라이더",
    pitches: [P("포심 패스트볼", 154, 159, 0, -0.2), P("슬라이더", 140, 148, -2.1, 0.9), P("너클 커브", 130, 137, -1.2, 2.7)] },
  { name: "클레이튼 커쇼", throws: "L", velo: 151, control: 9, legend: true, sig: "커브", nickname: "커쇼",
    pitches: [P("포심 패스트볼", 146, 151, 0, -0.2), P("슬라이더", 136, 142, -1.9, 1.0), P("커브", 118, 126, -1.0, 3.2)] },
  { name: "페드로 마르티네스", throws: "R", velo: 156, control: 10, legend: true, sig: "체인지업",
    pitches: [P("포심 패스트볼", 150, 156, 0, -0.2), P("체인지업", 132, 140, 1.2, 2.2), P("커브", 120, 128, -1.3, 2.8)] },
  { name: "류현진", throws: "L", velo: 148, control: 10, legend: true, sig: "체인지업", nickname: "괴물",
    pitches: [P("포심 패스트볼", 143, 148, 0, -0.2), P("체인지업", 125, 133, 1.2, 2.0), P("커터", 136, 141, -0.9, 0.5), P("커브", 112, 120, -1.1, 2.9)] },
  { name: "박찬호", throws: "R", velo: 157, control: 7, legend: true, sig: "커브", nickname: "코리안 특급",
    pitches: [P("포심 패스트볼", 151, 157, 0, -0.2), P("커브", 120, 130, -1.3, 3.0), P("슬라이더", 136, 143, -1.8, 0.9)] },
];

let userTeamId = "";
const uid = () => Math.random().toString(36).slice(2, 9);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
export const listingName = (l: Listing) => (l.batter ?? l.pitcher)!.name;
export const listingTeam = (from: string) => (from === "MLB" ? "MLB" : TEAMS.find((t) => t.id === from)!.short);

export function createMarket(user: string): MarketState {
  userTeamId = user;
  const money: Record<string, number> = {};
  const rosters: Record<string, Roster> = {};
  TEAMS.forEach((t) => {
    money[t.id] = 20000 + Math.round(Math.random() * 10000); // 2~3억$
    rosters[t.id] = { lineup: [...t.lineup], rotation: [...t.rotation] };
  });
  return refill({ gameNo: 0, money, rosters, listings: [], news: [] }, 6);
}

/** 팀 데이터에 이적 반영 */
export function teamWithRoster(t: Team, m: MarketState | undefined): Team {
  const r = m?.rosters[t.id];
  return r ? { ...t, lineup: r.lineup, rotation: r.rotation } : t;
}

/** 예상 가치 범위 (플레이어에게 보여주는 값) */
export function valueRange(v: number): [number, number] {
  return [Math.round(v * 0.8), Math.round(v * 1.3)];
}

function refill(m: MarketState, want: number): MarketState {
  const listings = [...m.listings];
  const open = () => listings.filter((l) => !l.userListed && !l.direct).length;
  let guard = 0;
  while (open() < want && guard++ < 50) {
    if (Math.random() < 0.06) {
      // 낮은 확률로 메이저리그 스타
      const isB = Math.random() < 0.55;
      const pl = isB ? pick(MLB_BATTERS) : pick(MLB_PITCHERS);
      const taken = TEAMS.some((t) => [...m.rosters[t.id]!.lineup, ...m.rosters[t.id]!.rotation].some((x) => x.name === pl.name));
      if (taken || listings.some((l) => listingName(l) === pl.name)) continue;
      const value = Math.round((isB ? batterValue(pl as Batter) : pitcherValue(pl as Pitcher)) * 1.8);
      listings.push({ id: uid(), kind: isB ? "B" : "P", batter: isB ? (pl as Batter) : undefined, pitcher: isB ? undefined : (pl as Pitcher),
        from: "MLB", value, closesAt: m.gameNo + WAIT, bids: [] });
      continue;
    }
    const t = pick(TEAMS);
    const r = m.rosters[t.id]!;
    if (t.id === userTeamId) continue;
    const isB = Math.random() < 0.55;
    if (isB && r.lineup.length <= MIN_BATTERS) continue;
    if (!isB && r.rotation.length <= MIN_PITCHERS) continue;
    const pl = isB ? pick(r.lineup) : pick(r.rotation);
    if (listings.some((l) => listingName(l) === pl.name)) continue;
    const value = isB ? batterValue(pl as Batter) : pitcherValue(pl as Pitcher);
    listings.push({ id: uid(), kind: isB ? "B" : "P", batter: isB ? (pl as Batter) : undefined, pitcher: isB ? undefined : (pl as Pitcher),
      from: t.id, value, closesAt: m.gameNo + WAIT, bids: [] });
  }
  return { ...m, listings };
}

/** 유저 오퍼 등록/수정 (금액 제한 없음) */
export function placeBid(m: MarketState, user: string, id: string, amount: number): MarketState {
  return {
    ...m,
    listings: m.listings.map((l) => (l.id === id ? { ...l, bids: [...l.bids.filter((b) => b.team !== user), { team: user, amount }] } : l)),
  };
}

/** 타팀 선수에게 직접 오퍼 */
export function directOffer(m: MarketState, user: string, from: string, name: string, amount: number): MarketState {
  const r = m.rosters[from]!;
  const b = r.lineup.find((x) => x.name === name);
  const p = r.rotation.find((x) => x.name === name);
  const value = b ? batterValue(b) : pitcherValue(p!);
  const listings = m.listings.filter((l) => !(l.direct && listingName(l) === name));
  listings.push({ id: uid(), kind: b ? "B" : "P", batter: b, pitcher: p, from, value, closesAt: m.gameNo + 2, bids: [{ team: user, amount }], direct: true });
  return { ...m, listings };
}

/** 내 선수를 매물로 등록 */
export function listOwn(m: MarketState, user: string, name: string): MarketState {
  const r = m.rosters[user]!;
  const b = r.lineup.find((x) => x.name === name);
  const p = r.rotation.find((x) => x.name === name);
  if (!b && !p) return m;
  const value = b ? batterValue(b) : pitcherValue(p!);
  return { ...m, listings: [...m.listings, { id: uid(), kind: b ? "B" : "P", batter: b, pitcher: p, from: user, value, closesAt: m.gameNo + WAIT, bids: [], userListed: true }] };
}
export function cancelListing(m: MarketState, id: string): MarketState {
  return { ...m, listings: m.listings.filter((l) => l.id !== id) };
}

function transfer(m: MarketState, l: Listing, to: string, amount: number) {
  if (l.from !== "MLB") {
    const fr = m.rosters[l.from]!;
    m.rosters[l.from] = l.batter
      ? { ...fr, lineup: fr.lineup.filter((x) => x.name !== l.batter!.name) }
      : { ...fr, rotation: fr.rotation.filter((x) => x.name !== l.pitcher!.name) };
    m.money[l.from] = (m.money[l.from] ?? 0) + amount;
  }
  const tr = m.rosters[to]!;
  m.rosters[to] = l.batter ? { ...tr, lineup: [...tr.lineup, l.batter] } : { ...tr, rotation: [...tr.rotation, l.pitcher!] };
  m.money[to] = (m.money[to] ?? 0) - amount;
}

/** 원래 소속팀이 아직 그 선수를 보유 중인지 */
function stillThere(m: MarketState, l: Listing) {
  if (l.from === "MLB") return true;
  const r = m.rosters[l.from]!;
  return l.batter ? r.lineup.some((x) => x.name === l.batter!.name) : r.rotation.some((x) => x.name === l.pitcher!.name);
}

/** 한 경기 경과: CPU 입찰 → 마감된 매물 체결 → 새 매물 */
export function marketTick(m0: MarketState, user: string): MarketState {
  userTeamId = user;
  const m: MarketState = { ...m0, gameNo: m0.gameNo + 1, money: { ...m0.money }, rosters: { ...m0.rosters }, news: [...m0.news] };
  let listings = m0.listings.map((l) => ({ ...l, bids: [...l.bids] }));

  // CPU 팀 적극 입찰
  for (const l of listings) {
    if (l.direct) continue;
    for (const t of TEAMS) {
      if (t.id === user || t.id === l.from || l.bids.some((b) => b.team === t.id)) continue;
      const r = m.rosters[t.id]!;
      const need = l.batter ? (r.lineup.length < 12 ? 1.4 : 0.8) : r.rotation.length < 9 ? 1.4 : 0.8;
      const p = (l.userListed ? 0.22 : 0.12) * need;
      if (Math.random() < p) {
        const amt = Math.round(l.value * (0.8 + Math.random() * 0.55));
        if ((m.money[t.id] ?? 0) >= amt) l.bids.push({ team: t.id, amount: amt });
      }
    }
  }

  const keep: Listing[] = [];
  for (const l of listings) {
    if (l.closesAt > m.gameNo) { keep.push(l); continue; }
    if (!stillThere(m, l)) continue;
    const name = listingName(l);
    const fromName = listingTeam(l.from);
    // 자금 부족 / 로스터 하한 확인
    const fr = l.from !== "MLB" ? m.rosters[l.from]! : null;
    if (fr && (l.batter ? fr.lineup.length <= MIN_BATTERS : fr.rotation.length <= MIN_PITCHERS)) {
      if (l.bids.some((b) => b.team === user)) m.news.unshift(`❌ ${fromName}이(가) 로스터 부족으로 ${name} 이적을 거절했습니다.`);
      continue;
    }
    const bids = l.bids.filter((b) => (m.money[b.team] ?? 0) >= b.amount);
    if (l.direct) {
      const b = bids[0];
      if (!b) continue;
      // 직접 오퍼: 기본 성공률 낮음
      const p = Math.min(0.75, 0.12 * Math.pow(b.amount / l.value, 2));
      if (Math.random() < p) {
        transfer(m, l, b.team, b.amount);
        m.news.unshift(`✅ 직접 오퍼 성공! ${TEAMS.find((t) => t.id === b.team)!.short}이(가) ${fromName}의 ${name}을(를) ${fmtMoney(b.amount)}에 영입`);
      } else m.news.unshift(`❌ ${fromName}이(가) ${name}에 대한 오퍼(${fmtMoney(b.amount)})를 거절했습니다.`);
      continue;
    }
    // 선수 본인이 최소 기대치 이상 오퍼 중에서 금액 기반 확률로 선택
    const ok = bids.filter((b) => b.amount >= l.value * 0.7);
    if (!ok.length) {
      if (l.userListed) m.news.unshift(`📭 ${name} 매물에 관심 있는 팀이 없었습니다.`);
      else if (l.bids.some((b) => b.team === user)) m.news.unshift(`❌ ${name}이(가) 오퍼 금액이 낮아 이적을 거부했습니다.`);
      continue;
    }
    const w = ok.map((b) => Math.pow(b.amount, 4));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let win = ok[0]!;
    for (let i = 0; i < ok.length; i++) { r -= w[i]!; if (r <= 0) { win = ok[i]!; break; } }
    transfer(m, l, win.team, win.amount);
    const to = TEAMS.find((t) => t.id === win.team)!.short;
    const tag = l.from === "MLB" ? "🌟 [MLB] " : win.team === user ? "✅ " : l.userListed ? "💰 " : "📰 ";
    m.news.unshift(`${tag}${to}이(가) ${l.from === "MLB" ? "" : fromName + "의 "}${name}을(를) ${fmtMoney(win.amount)}에 영입${ok.length > 1 ? ` (경쟁 ${ok.length}팀)` : ""}`);
  }
  m.listings = keep;
  m.news = m.news.slice(0, 60);
  return refill(m, 6);
}
