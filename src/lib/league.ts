import { TEAMS, type Team } from "./kbo-data";
import { simulateMatch, type SimulatedGame } from "./simulation";

export type SimulationContext = {
  team?: (id: string) => Team;
  starter?: (id: string) => number;
  onGame?: (home: string, away: string, game: SimulatedGame) => void;
};

// ================= 실제 KBO 방식 리그전 =================
// 정규시즌: 10개 구단 라운드로빈 (한 라운드 = 각 팀 1경기, 총 9라운드 = 팀당 9경기)
// 포스트시즌: 와일드카드 결정전(4위 1승 어드밴티지) → 준플레이오프(5전3선승)
//             → 플레이오프(5전3선승) → 한국시리즈(7전4선승)

export type ScheduleGame = {
  id: number;
  round: number;
  home: string; // team id
  away: string;
  hs?: number;
  as?: number;
  done: boolean;
};

export type Standing = {
  id: string;
  w: number;
  l: number;
  d: number;
  rs: number; // 득점
  ra: number; // 실점
};

export type SeriesKind = "WC" | "SEMI" | "PO" | "KS";

export type Series = {
  kind: SeriesKind;
  high: string; // 상위 시드
  low: string;
  needed: number; // 상위 시드가 시리즈를 잡기 위한 승수
  neededLow: number;
  wHigh: number;
  wLow: number;
  games: { home: string; away: string; hs: number; as: number }[];
  winner?: string;
};

export type LeagueState = {
  userTeamId: string;
  innings: number;
  starterIdx: number;
  schedule: ScheduleGame[];
  cursor: number; // 다음에 치를 경기 index (schedule 상)
  standings: Record<string, Standing>;
  stage: "regular" | "post" | "done";
  post: Series[];
  champion?: string;
  news: string[];
};

export const SERIES_LABEL: Record<SeriesKind, string> = {
  WC: "와일드카드 결정전",
  SEMI: "준플레이오프",
  PO: "플레이오프",
  KS: "한국시리즈",
};

const teamById = (id: string): Team => TEAMS.find((t) => t.id === id)!;

// ---------- 팀 전력 ----------
export function teamStrength(t: Team) {
  const bats = t.lineup.slice(0, 9);
  const off =
    bats.reduce((s, b) => s + b.contact * 0.6 + b.power * 0.4, 0) / Math.max(1, bats.length);
  const arms = t.rotation.slice(0, 6);
  const def =
    arms.reduce((s, p) => s + p.control * 0.5 + (p.velo - 140) * 0.35, 0) / Math.max(1, arms.length);
  return { off, def };
}

function poisson(mean: number) {
  const l = Math.exp(-Math.max(0.2, mean));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > l);
  return k - 1;
}

/** 타석 단위 시뮬레이션 — 선수별 기록은 context.onGame으로 전달 */
export function simGame(homeId: string, awayId: string, innings: number, context?: SimulationContext, decided = false) {
  void poisson;
  const team = context?.team ?? teamById;
  const g = simulateMatch(team(homeId), team(awayId), innings, {
    homeStarter: context?.starter?.(homeId), awayStarter: context?.starter?.(awayId), decided,
  });
  context?.onGame?.(homeId, awayId, g);
  return { hs: g.hs, as: g.as };
}

/** 무승부 없이 승부를 가려야 하는 포스트시즌용 */
export function simGameDecided(homeId: string, awayId: string, innings: number, context?: SimulationContext) {
  return simGame(homeId, awayId, innings, context, true);
}

// ---------- 일정 (원형 라운드로빈) ----------
function roundRobin(ids: string[]): { home: string; away: string }[][] {
  const list = [...ids];
  const n = list.length;
  const rounds: { home: string; away: string }[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const games: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i]!;
      const b = list[n - 1 - i]!;
      games.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(games);
    // 회전 (첫 팀 고정)
    const fixed = list.shift()!;
    const last = list.pop()!;
    list.unshift(last);
    list.unshift(fixed);
  }
  return rounds;
}

export function createLeague(userTeamId: string, innings: number, starterIdx: number, cycles: number): LeagueState {
  const ids = TEAMS.map((t) => t.id);
  const base = roundRobin(ids);
  const schedule: ScheduleGame[] = [];
  let id = 0;
  let round = 0;
  for (let c = 0; c < cycles; c++) {
    for (const rGames of base) {
      round++;
      // 사이클마다 홈/원정 교대
      const games = c % 2 === 0 ? rGames : rGames.map((g) => ({ home: g.away, away: g.home }));
      // 유저 경기를 라운드 맨 앞으로
      const sorted = [...games].sort((x, y) => {
        const xu = x.home === userTeamId || x.away === userTeamId ? 0 : 1;
        const yu = y.home === userTeamId || y.away === userTeamId ? 0 : 1;
        return xu - yu;
      });
      for (const g of sorted) schedule.push({ id: id++, round, home: g.home, away: g.away, done: false });
    }
  }
  const standings: Record<string, Standing> = {};
  for (const t of TEAMS) standings[t.id] = { id: t.id, w: 0, l: 0, d: 0, rs: 0, ra: 0 };
  return {
    userTeamId,
    innings,
    starterIdx,
    schedule,
    cursor: 0,
    standings,
    stage: "regular",
    post: [],
    news: [],
  };
}

// ---------- 순위 ----------
export const winPct = (s: Standing) => (s.w + s.l === 0 ? 0 : s.w / (s.w + s.l));

export function sortedStandings(st: Record<string, Standing>): Standing[] {
  return Object.values(st).sort((a, b) => {
    const d = winPct(b) - winPct(a);
    if (Math.abs(d) > 1e-9) return d;
    if (b.w !== a.w) return b.w - a.w;
    return b.rs - b.ra - (a.rs - a.ra);
  });
}

/** 1위와의 게임차 */
export function gamesBehind(top: Standing, s: Standing) {
  return ((top.w - s.w) + (s.l - top.l)) / 2;
}

function applyResult(st: Record<string, Standing>, g: ScheduleGame) {
  const h = st[g.home]!;
  const a = st[g.away]!;
  h.rs += g.hs!; h.ra += g.as!;
  a.rs += g.as!; a.ra += g.hs!;
  if (g.hs! > g.as!) { h.w++; a.l++; }
  else if (g.hs! < g.as!) { a.w++; h.l++; }
  else { h.d++; a.d++; }
}

export function nextUserGame(L: LeagueState): ScheduleGame | null {
  for (let i = L.cursor; i < L.schedule.length; i++) {
    const g = L.schedule[i]!;
    if (!g.done && (g.home === L.userTeamId || g.away === L.userTeamId)) return g;
  }
  return null;
}

/** 유저 경기 전까지의 다른 팀 경기를 모두 자동 진행 */
export function simUntilUserGame(L: LeagueState, context?: SimulationContext): LeagueState {
  const st = structuredClone(L.standings);
  const schedule = L.schedule.map((g) => ({ ...g }));
  let cursor = L.cursor;
  const news: string[] = [];
  while (cursor < schedule.length) {
    const g = schedule[cursor]!;
    if (g.home === L.userTeamId || g.away === L.userTeamId) break;
    const r = simGame(g.home, g.away, L.innings, context);
    g.hs = r.hs; g.as = r.as; g.done = true;
    applyResult(st, g);
    news.push(
      `${g.round}R ${teamById(g.away).short} ${g.as} : ${g.hs} ${teamById(g.home).short}`,
    );
    cursor++;
  }
  return { ...L, standings: st, schedule, cursor, news: [...news.slice(-5), ...L.news].slice(0, 40) };
}

/** 유저가 직접 치른 경기 결과 기록 */
export function recordUserGame(L: LeagueState, userScore: number, oppScore: number): LeagueState {
  const g0 = nextUserGame(L);
  if (!g0) return L;
  const st = structuredClone(L.standings);
  const schedule = L.schedule.map((g) => ({ ...g }));
  const g = schedule.find((x) => x.id === g0.id)!;
  const userHome = g.home === L.userTeamId;
  g.hs = userHome ? userScore : oppScore;
  g.as = userHome ? oppScore : userScore;
  g.done = true;
  applyResult(st, g);
  const idx = schedule.findIndex((x) => x.id === g.id);
  const news = [
    `${g.round}R ${teamById(g.away).short} ${g.as} : ${g.hs} ${teamById(g.home).short} (내 경기)`,
    ...L.news,
  ].slice(0, 40);
  return { ...L, standings: st, schedule, cursor: Math.max(L.cursor, idx + 1), news };
}

export function regularDone(L: LeagueState) {
  return L.schedule.every((g) => g.done);
}

/** 정규시즌 잔여 경기 전부 자동 진행 */
export function simRestOfSeason(L: LeagueState, context?: SimulationContext): LeagueState {
  const st = structuredClone(L.standings);
  const schedule = L.schedule.map((g) => ({ ...g }));
  for (const g of schedule) {
    if (g.done) continue;
    const r = simGame(g.home, g.away, L.innings, context);
    g.hs = r.hs; g.as = r.as; g.done = true;
    applyResult(st, g);
  }
  return { ...L, standings: st, schedule, cursor: schedule.length };
}

// ---------- 포스트시즌 ----------
function makeSeries(kind: SeriesKind, high: string, low: string): Series {
  if (kind === "WC") return { kind, high, low, needed: 1, neededLow: 2, wHigh: 0, wLow: 0, games: [] };
  if (kind === "KS") return { kind, high, low, needed: 4, neededLow: 4, wHigh: 0, wLow: 0, games: [] };
  return { kind, high, low, needed: 3, neededLow: 3, wHigh: 0, wLow: 0, games: [] };
}

/** 시리즈별 홈 구장 (상위 시드 우선) — WC는 전 경기 4위 홈 */
export function homeForGame(s: Series, gameNo: number) {
  if (s.kind === "WC") return s.high;
  if (s.kind === "KS") return [0, 1, 4, 5, 6].includes(gameNo) ? s.high : s.low;
  return [0, 1, 4].includes(gameNo) ? s.high : s.low;
}

export function startPostseason(L: LeagueState): LeagueState {
  const rank = sortedStandings(L.standings);
  const s = makeSeries("WC", rank[3]!.id, rank[4]!.id);
  return {
    ...L,
    stage: "post",
    post: [s],
    news: ["🏟️ 정규시즌 종료 — 포스트시즌 시작!", ...L.news].slice(0, 40),
  };
}

export function currentSeries(L: LeagueState): Series | null {
  const s = L.post[L.post.length - 1];
  return s && !s.winner ? s : null;
}

export function nextSeriesGameNo(s: Series) {
  return s.games.length;
}

export function userInSeries(L: LeagueState, s: Series) {
  return s.high === L.userTeamId || s.low === L.userTeamId;
}

function advanceBracket(L: LeagueState, finished: Series): LeagueState {
  const rank = sortedStandings(L.standings);
  const w = finished.winner!;
  let next: Series | null = null;
  if (finished.kind === "WC") next = makeSeries("SEMI", rank[2]!.id, w);
  else if (finished.kind === "SEMI") next = makeSeries("PO", rank[1]!.id, w);
  else if (finished.kind === "PO") next = makeSeries("KS", rank[0]!.id, w);
  const news = [
    `${SERIES_LABEL[finished.kind]} — ${teamById(w).name} 승리 (${finished.wHigh}승 ${finished.wLow}승)`,
    ...L.news,
  ].slice(0, 40);
  if (!next) {
    return { ...L, stage: "done", champion: w, news: [`🏆 ${teamById(w).name} 한국시리즈 우승!`, ...news].slice(0, 40) };
  }
  return { ...L, post: [...L.post, next], news };
}

/** 포스트시즌 1경기 결과 반영 (userScore 미지정 시 자동 시뮬) */
export function playSeriesGame(L: LeagueState, result?: { userScore: number; oppScore: number }, context?: SimulationContext): LeagueState {
  const cur = currentSeries(L);
  if (!cur) return L;
  const gameNo = nextSeriesGameNo(cur);
  const home = homeForGame(cur, gameNo);
  const away = home === cur.high ? cur.low : cur.high;
  let hs: number;
  let as: number;
  if (result) {
    const userHome = home === L.userTeamId;
    hs = userHome ? result.userScore : result.oppScore;
    as = userHome ? result.oppScore : result.userScore;
    if (hs === as) hs += 1; // 포스트시즌 무승부 없음 (연장 끝내기 처리)
  } else {
    const r = simGameDecided(home, away, L.innings, context);
    hs = r.hs; as = r.as;
  }
  const winnerId = hs > as ? home : away;
  const s: Series = {
    ...cur,
    games: [...cur.games, { home, away, hs, as }],
    wHigh: cur.wHigh + (winnerId === cur.high ? 1 : 0),
    wLow: cur.wLow + (winnerId === cur.low ? 1 : 0),
  };
  if (s.wHigh >= s.needed) s.winner = s.high;
  else if (s.wLow >= s.neededLow) s.winner = s.low;
  const post = [...L.post.slice(0, -1), s];
  const news = [
    `${SERIES_LABEL[s.kind]} ${gameNo + 1}차전 ${teamById(away).short} ${as} : ${hs} ${teamById(home).short}`,
    ...L.news,
  ].slice(0, 40);
  const L2 = { ...L, post, news };
  return s.winner ? advanceBracket(L2, s) : L2;
}
