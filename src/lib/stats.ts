// 시즌 성적 누적 도메인 (브라우저 안전, UI와 분리해 테스트 가능)
export type BatterStat = { pa: number; ab: number; h: number; hr: number; rbi: number; bb: number; so: number };
export type PitcherStat = { outs: number; er: number; w: number; l: number; hld: number; sv: number };
export type TeamStats = { batters: Record<string, BatterStat>; pitchers: Record<string, PitcherStat> };
export type SeasonStats = Record<string, TeamStats>;
/** 한 경기分의 선수별 증분 (경기 엔진이 기록) */
export type GameStatLine = {
  batting: Record<string, Partial<BatterStat>>;
  pitching: Record<string, Partial<PitcherStat>>;
};
export type MatchStats = { user: GameStatLine; cpu: GameStatLine };

export const emptyBatterStat = (): BatterStat => ({ pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, so: 0 });
export const emptyPitcherStat = (): PitcherStat => ({ outs: 0, er: 0, w: 0, l: 0, hld: 0, sv: 0 });
export const emptyGameLine = (): GameStatLine => ({ batting: {}, pitching: {} });
export const createSeasonStats = (): SeasonStats => ({});

/** 한 경기 기록을 시즌 누적에 불변 병합 */
export function mergeGameStats(season: SeasonStats, teamId: string, line: GameStatLine): SeasonStats {
  const prev = season[teamId] ?? { batters: {}, pitchers: {} };
  const batters: Record<string, BatterStat> = { ...prev.batters };
  for (const [name, d] of Object.entries(line.batting)) {
    const c = batters[name] ?? emptyBatterStat();
    batters[name] = {
      pa: c.pa + (d.pa ?? 0), ab: c.ab + (d.ab ?? 0), h: c.h + (d.h ?? 0),
      hr: c.hr + (d.hr ?? 0), rbi: c.rbi + (d.rbi ?? 0), bb: c.bb + (d.bb ?? 0), so: c.so + (d.so ?? 0),
    };
  }
  const pitchers: Record<string, PitcherStat> = { ...prev.pitchers };
  for (const [name, d] of Object.entries(line.pitching)) {
    const c = pitchers[name] ?? emptyPitcherStat();
    pitchers[name] = {
      outs: c.outs + (d.outs ?? 0), er: c.er + (d.er ?? 0),
      w: c.w + (d.w ?? 0), l: c.l + (d.l ?? 0), hld: c.hld + (d.hld ?? 0), sv: c.sv + (d.sv ?? 0),
    };
  }
  return { ...season, [teamId]: { batters, pitchers } };
}

export const batAvg = (s: BatterStat) => (s.ab > 0 ? s.h / s.ab : 0);
/** 기존 저장에는 기록이 없어도 두 팀의 경기 기록을 함께 누적한다. */
export function mergeMatchStats(season: SeasonStats | undefined, userId: string, cpuId: string, lines?: MatchStats): SeasonStats {
  const current = season ?? createSeasonStats();
  if (!lines) return current;
  return mergeGameStats(mergeGameStats(current, userId, lines.user), cpuId, lines.cpu);
}
/** 방어율: 9이닝(27아웃) 기준 */
export const era = (s: PitcherStat) => (s.outs > 0 ? (s.er * 27) / s.outs : 0);
export const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, "");
export const formatIP = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`;
