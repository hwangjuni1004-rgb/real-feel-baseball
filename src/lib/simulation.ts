import { type Team } from "./kbo-data";
import { emptyBatterStat, emptyGameLine, emptyPitcherStat, type GameStatLine } from "./stats";

export type SimulatedGame = { hs: number; as: number; homeStats: GameStatLine; awayStats: GameStatLine };
export type SimulationOptions = { random?: () => number; homeStarter?: number; awayStarter?: number; decided?: boolean };

/** 타석별 결과로 점수와 성적을 함께 생성한다. 자동 경기의 선발은 완투한다. */
export function simulateMatch(home: Team, away: Team, innings: number, options: SimulationOptions = {}): SimulatedGame {
  const random = options.random ?? Math.random;
  const teams = [away, home];
  const lines = [emptyGameLine(), emptyGameLine()];
  const pitchers = [away.rotation[options.awayStarter ?? 0] ?? away.rotation[0], home.rotation[options.homeStarter ?? 0] ?? home.rotation[0]];
  if (!pitchers[0] || !pitchers[1] || !home.lineup.length || !away.lineup.length) throw new Error("경기에 필요한 선수 구성이 부족합니다.");
  const scores = [0, 0];
  const order = [0, 0];
  const scheduled = Math.max(1, Math.floor(innings));
  const lastInning = scheduled + (options.decided ? 30 : 3);
  for (let inning = 1; inning <= lastInning; inning++) {
    for (const side of [0, 1]) {
      if (side === 1 && inning >= scheduled && (scores[1] ?? 0) > (scores[0] ?? 0)) break;
      const team = teams[side];
      const line = lines[side];
      const defense = teams[1 - side];
      const pitching = lines[1 - side];
      const pitcher = pitchers[1 - side];
      if (!team || !line || !defense || !pitching || !pitcher) continue;
      const ps = pitching.pitching[pitcher.name] ?? emptyPitcherStat();
      pitching.pitching[pitcher.name] = ps;
      let outs = 0;
      let bases = [false, false, false];
      let appearances = 0;
      while (outs < 3) {
        const batter = team.lineup[(order[side] ?? 0) % Math.min(9, team.lineup.length)];
        if (!batter) break;
        order[side] = (order[side] ?? 0) + 1;
        const bs = line.batting[batter.name] ?? emptyBatterStat();
        line.batting[batter.name] = bs;
        bs.pa = (bs.pa ?? 0) + 1;
        const fielding = defense.lineup.slice(0, 9).reduce((s, b) => s + (b.defense ?? 5), 0) / Math.min(9, defense.lineup.length);
        const walk = Math.max(0.035, 0.13 - pitcher.control * 0.008);
        const hit = Math.max(0.16, Math.min(0.38, 0.26 + (batter.contact - 5) * 0.018 - (pitcher.velo - 145) * 0.003 - (fielding - 5) * 0.006));
        const roll = random();
        let runs = 0;
        let homeRun = false;
        if (++appearances <= 100 && roll < walk) {
          bs.bb = (bs.bb ?? 0) + 1;
          if (bases[0]) {
            if (bases[1]) { if (bases[2]) runs++; bases[2] = true; }
            bases[1] = true;
          }
          bases[0] = true;
        } else {
          bs.ab = (bs.ab ?? 0) + 1;
          if (appearances <= 100 && roll < walk + hit) {
            bs.h = (bs.h ?? 0) + 1;
            const quality = random();
            const hrChance = Math.max(0.025, 0.05 + batter.power * 0.013 - (pitcher.velo - 145) * 0.0015);
            const distance = quality < hrChance ? 4 : quality < hrChance + 0.02 ? 3 : quality < hrChance + 0.22 ? 2 : 1;
            if (distance === 4) { homeRun = true; bs.hr = (bs.hr ?? 0) + 1; runs = 1; }
            const next = [false, false, false];
            for (let base = 0; base < 3; base++) {
              if (!bases[base]) continue;
              if (base + distance >= 3) runs++; else next[base + distance] = true;
            }
            if (distance < 4) next[distance - 1] = true;
            bases = next;
          } else {
            outs++;
            ps.outs = (ps.outs ?? 0) + 1;
            if (random() < Math.min(0.55, 0.25 + (pitcher.velo - 145) * 0.008 + (pitcher.control - batter.contact) * 0.015)) bs.so = (bs.so ?? 0) + 1;
          }
        }
        // 끝내기 안타는 필요한 주자만 득점 (홈런은 전원 득점).
        if (side === 1 && inning >= scheduled && runs > 0 && !homeRun) {
          runs = Math.min(runs, Math.max(0, (scores[0] ?? 0) - (scores[1] ?? 0) + 1));
        }
        scores[side] = (scores[side] ?? 0) + runs;
        bs.rbi = (bs.rbi ?? 0) + runs;
        ps.er = (ps.er ?? 0) + runs;
        if (side === 1 && inning >= scheduled && (scores[1] ?? 0) > (scores[0] ?? 0)) break;
      }
    }
    if (inning >= scheduled && scores[0] !== scores[1]) break;
  }
  // 극단적인 난수에서도 포스트시즌을 무승부 없이 마친다. 끝내기 홈런 기록도 함께 남긴다.
  if (options.decided && scores[0] === scores[1]) {
    const batter = home.lineup[(order[1] ?? 0) % Math.min(9, home.lineup.length)];
    const line = lines[1];
    const pitching = lines[0];
    const pitcher = pitchers[0];
    if (batter && line && pitching && pitcher) {
      const bs = line.batting[batter.name] ?? emptyBatterStat();
      line.batting[batter.name] = { ...bs, pa: (bs.pa ?? 0) + 1, ab: (bs.ab ?? 0) + 1, h: (bs.h ?? 0) + 1, hr: (bs.hr ?? 0) + 1, rbi: (bs.rbi ?? 0) + 1 };
      const ps = pitching.pitching[pitcher.name] ?? emptyPitcherStat();
      pitching.pitching[pitcher.name] = { ...ps, er: (ps.er ?? 0) + 1 };
      scores[1] = (scores[1] ?? 0) + 1;
    }
  }
  if (scores[0] !== scores[1]) {
    const winner = (scores[1] ?? 0) > (scores[0] ?? 0) ? 1 : 0;
    const wp = pitchers[winner]; const lp = pitchers[1 - winner];
    const wl = lines[winner]; const ll = lines[1 - winner];
    if (wp && lp && wl && ll) {
      const ws = wl.pitching[wp.name] ?? emptyPitcherStat();
      const ls = ll.pitching[lp.name] ?? emptyPitcherStat();
      wl.pitching[wp.name] = { ...ws, w: 1 };
      ll.pitching[lp.name] = { ...ls, l: 1 };
    }
  }
  return { hs: scores[1] ?? 0, as: scores[0] ?? 0, homeStats: lines[1] ?? emptyGameLine(), awayStats: lines[0] ?? emptyGameLine() };
}