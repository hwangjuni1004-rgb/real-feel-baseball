// 시즌 종료 정산: 순위 상금·우승 보너스·개인 타이틀 (브라우저 안전, 테스트 가능)
import { batAvg, era, type SeasonStats } from "./stats";

/** 최종 순위별 상금 (만$) — 1위부터 10위 */
export const RANK_PRIZE = [5000, 3500, 2500, 1800, 1200, 800, 600, 400, 300, 200];
export const CHAMPION_BONUS = 3000;
export const AWARD_PRIZE = 500;

export type Award = { title: string; team: string; name: string; detail: string };

/** 타석·이닝이 리그 최다의 절반 이상인 선수만 규정 기록으로 인정 */
export function seasonAwards(stats: SeasonStats): Award[] {
  const bats = Object.entries(stats).flatMap(([team, t]) => Object.entries(t.batters).map(([name, s]) => ({ team, name, s })));
  const arms = Object.entries(stats).flatMap(([team, t]) => Object.entries(t.pitchers).map(([name, s]) => ({ team, name, s })));
  const out: Award[] = [];
  const maxPa = Math.max(0, ...bats.map((b) => b.s.pa));
  const qb = bats.filter((b) => b.s.pa > 0 && b.s.pa >= maxPa * 0.5);
  const best = <X,>(xs: X[], f: (x: X) => number) => xs.reduce<X | null>((a, x) => (a === null || f(x) > f(a) ? x : a), null);
  const mvp = best(qb, (b) => b.s.h + b.s.hr * 3 + b.s.rbi * 1.5 + b.s.bb * 0.5);
  if (mvp) out.push({ title: "정규시즌 MVP", team: mvp.team, name: mvp.name, detail: `${mvp.s.h}안타 ${mvp.s.hr}홈런 ${mvp.s.rbi}타점` });
  const hr = best(bats, (b) => b.s.hr);
  if (hr && hr.s.hr > 0) out.push({ title: "홈런왕", team: hr.team, name: hr.name, detail: `${hr.s.hr}홈런` });
  const avg = best(qb, (b) => batAvg(b.s));
  if (avg) out.push({ title: "타격왕", team: avg.team, name: avg.name, detail: `타율 ${batAvg(avg.s).toFixed(3).replace(/^0/, "")}` });
  const maxOuts = Math.max(0, ...arms.map((p) => p.s.outs));
  const qp = arms.filter((p) => p.s.outs > 0 && p.s.outs >= maxOuts * 0.5);
  const ace = best(qp, (p) => -era(p.s));
  if (ace) out.push({ title: "평균자책점왕", team: ace.team, name: ace.name, detail: `방어율 ${era(ace.s).toFixed(2)}` });
  const win = best(arms, (p) => p.s.w);
  if (win && win.s.w > 0) out.push({ title: "다승왕", team: win.team, name: win.name, detail: `${win.s.w}승` });
  return out;
}

/** 순위 상금·우승 보너스·타이틀 상금을 구단 자금에 더하고 뉴스를 만든다 */
export function settleSeason(money: Record<string, number>, ranking: string[], champion: string | undefined, awards: Award[], teamName: (id: string) => string) {
  const m = { ...money };
  const news: string[] = [];
  ranking.forEach((id, i) => { m[id] = (m[id] ?? 0) + (RANK_PRIZE[i] ?? 0); });
  if (champion) {
    m[champion] = (m[champion] ?? 0) + CHAMPION_BONUS;
    news.push(`💰 ${teamName(champion)} 우승 보너스 ${CHAMPION_BONUS.toLocaleString()}만$`);
  }
  for (const a of awards) {
    m[a.team] = (m[a.team] ?? 0) + AWARD_PRIZE;
    news.push(`🏅 ${a.title}: ${a.name} (${teamName(a.team)}) — ${a.detail}`);
  }
  news.push(`💵 순위 상금 지급 완료 — 1위 ${teamName(ranking[0]!)} ${RANK_PRIZE[0]!.toLocaleString()}만$`);
  return { money: m, news };
}
