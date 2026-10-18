import { useEffect, useState, type ReactNode } from "react";
import { TEAMS, POS_LABEL, batterValue, fieldingAt, fmtMoney, type Team, type Batter, type Position } from "@/lib/kbo-data";
import {
  createLeague, simUntilUserGame, nextUserGame, recordUserGame, regularDone, simRestOfSeason,
  startPostseason, currentSeries, userInSeries, playSeriesGame, homeForGame, nextSeriesGameNo,
  sortedStandings, gamesBehind, winPct, SERIES_LABEL, type LeagueState,
} from "@/lib/league";
import { createMarket, marketTick, teamWithRoster, type MarketState } from "@/lib/market";
import { MarketTab, TeamsTab } from "./MarketTab";
import { TradeTab } from "./TradeTab";
import { Button } from "./ui/button";

const KEY = "kbo-league-v1";
const FIELD: Position[] = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
const teamById = (id: string) => TEAMS.find((t) => t.id === id)!;

export type LineupSlot = { name: string; pos: Position };
type Saved = { league: LeagueState; lineup: LineupSlot[]; market?: MarketState };

export type MatchRender = (p: {
  userTeam: Team; cpuTeam: Team; innings: number; starterIdx: number;
  onFinish: (u: number, c: number) => void;
}) => ReactNode;

/** 제포지션이 아니면 정확·파워 -1 (지명타자는 누구나 무보정) */
export function applyLineup(team: Team, slots: LineupSlot[]): Team {
  const lineup: Batter[] = slots.map((s) => {
    const b = team.lineup.find((x) => x.name === s.name)!;
    const off = s.pos !== "DH" && s.pos !== b.pos;
    return off
      ? { ...b, pos: s.pos, contact: Math.max(1, b.contact - 1), power: Math.max(1, b.power - 1) }
      : { ...b, pos: s.pos };
  });
  return { ...team, lineup };
}

/** 이적으로 빠진 선수를 라인업에서 제거하고 남은 선수로 채움 */
function repairLineup(team: Team, slots: LineupSlot[]): LineupSlot[] {
  const names = new Set(team.lineup.map((b) => b.name));
  const kept = slots.filter((s) => names.has(s.name));
  if (kept.length === 9) return slots;
  const used = new Set(kept.map((s) => s.name));
  const free = FIELD.filter((p) => !kept.some((s) => s.pos === p));
  for (const b of team.lineup) {
    if (kept.length >= 9 || used.has(b.name)) continue;
    const pos = free.includes(b.pos) ? b.pos : free[0]!;
    free.splice(free.indexOf(pos), 1);
    kept.push({ name: b.name, pos });
    used.add(b.name);
  }
  return kept;
}

function defaultLineup(team: Team): LineupSlot[] {
  return team.lineup.slice(0, 9).map((b) => ({ name: b.name, pos: b.pos }));
}

export function LeagueMode({ onExit, renderMatch }: { onExit: () => void; renderMatch: MatchRender }) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<"home" | "lineup" | "market" | "trade" | "teams" | "standings" | "news">("home");

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setSaved(JSON.parse(s)); } catch { /* ignore */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
    else localStorage.removeItem(KEY);
  }, [saved, loaded]);

  if (!loaded) return null;
  if (!saved) return <LeagueSetup onExit={onExit} onCreate={(t, inn) => {
    const L = simUntilUserGame(createLeague(t.id, inn, 0, 1));
    setSaved({ league: L, lineup: defaultLineup(t), market: createMarket(t.id) });
  }} />;

  const L = saved.league;
  const market = saved.market ?? createMarket(L.userTeamId);
  const user = teamWithRoster(teamById(L.userTeamId), market);
  const lineup = repairLineup(user, saved.lineup);
  const userTeam = applyLineup(user, lineup);
  const update = (league: LeagueState) => setSaved({ ...saved, lineup, league, market: marketTick(market, L.userTeamId) });
  const setMarket = (m: MarketState) => setSaved({ ...saved, lineup, market: m });

  // 다음 상대
  let oppId: string | null = null;
  let label = "";
  const series = L.stage === "post" ? currentSeries(L) : null;
  if (L.stage === "regular") {
    const g = nextUserGame(L);
    if (g) { oppId = g.home === L.userTeamId ? g.away : g.home; label = `${g.round}라운드 · ${g.home === L.userTeamId ? "홈" : "원정"}`; }
  } else if (series && userInSeries(L, series)) {
    oppId = series.high === L.userTeamId ? series.low : series.high;
    const no = nextSeriesGameNo(series);
    label = `${SERIES_LABEL[series.kind]} ${no + 1}차전 · ${homeForGame(series, no) === L.userTeamId ? "홈" : "원정"}`;
  }

  if (playing && oppId) {
    return <>{renderMatch({
      userTeam, cpuTeam: teamWithRoster(teamById(oppId), market), innings: L.innings, starterIdx: L.starterIdx,
      onFinish: (u, c) => {
        setPlaying(false);
        if (L.stage === "regular") {
          let n = simUntilUserGame(recordUserGame(L, u, c));
          if (regularDone(n)) n = startPostseason(n);
          const nextStarter = (L.starterIdx + 1) % Math.max(1, Math.min(5, user.rotation.length));
          update({ ...n, starterIdx: nextStarter });
        } else {
          update(playSeriesGame(L, { userScore: u, oppScore: c }));
        }
      },
    })}</>;
  }

  const autoSim = () => {
    if (L.stage === "regular") {
      let n = simRestOfSeason(L);
      n = startPostseason(n);
      update(n);
    }
  };
  const simUser = () => {
    if (L.stage === "regular") {
      const g = nextUserGame(L);
      if (!g) return;
      // 유저 경기 자동 시뮬
      let n = simUntilUserGame(L);
      const ids = TEAMS.map((t) => t.id);
      void ids;
      const r = Math.random();
      const us = Math.floor(Math.random() * 7);
      const them = Math.floor(Math.random() * 7);
      void r;
      n = simUntilUserGame(recordUserGame(n, us, them));
      if (regularDone(n)) n = startPostseason(n);
      update(n);
    } else if (series) {
      update(playSeriesGame(L));
    }
  };

  const rank = sortedStandings(L.standings);
  const myRank = rank.findIndex((s) => s.id === L.userTeamId) + 1;
  const my = L.standings[L.userTeamId]!;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-stone-950 text-white">
      <div className="sticky top-0 z-20 bg-black/60 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={onExit} className="text-xs px-2 py-1 rounded bg-white/10">← 메뉴</button>
          <div className="w-3 h-8 rounded" style={{ background: user.color }} />
          <div className="flex-1">
            <div className="font-black">{user.name}</div>
            <div className="text-[11px] text-yellow-200">자금 {(market.money[L.userTeamId] ?? 0).toLocaleString()}만$</div>
            <div className="text-[11px] text-white/60">{my.w}승 {my.l}패 {my.d}무 · {myRank}위 · {L.stage === "regular" ? "정규시즌" : L.stage === "post" ? "포스트시즌" : "시즌 종료"}</div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto flex gap-1 mt-3 overflow-x-auto">
          {([["home", "경기"], ["lineup", "라인업"], ["market", "이적시장"], ["trade", "트레이드"], ["teams", "타팀 로스터"], ["standings", "순위"], ["news", "뉴스"]] as const).map(([k, v]) => (
            <Button key={k} variant="ghost" aria-pressed={tab === k} onClick={() => setTab(k)} className={`shrink-0 px-3 py-1.5 rounded text-sm font-bold ${tab === k ? "bg-yellow-400 text-black" : "bg-white/5"}`}>{v}</Button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {tab === "home" && (
          <div className="space-y-4">
            {L.stage === "done" ? (
              <div className="rounded-xl bg-yellow-400/15 border border-yellow-300/40 p-6 text-center">
                <div className="text-5xl mb-2">🏆</div>
                <div className="text-xl font-black">{teamById(L.champion!).name} 한국시리즈 우승!</div>
                <button onClick={() => { if (confirm("새 시즌을 시작할까요?")) setSaved(null); }} className="mt-4 px-5 py-2 rounded bg-yellow-400 text-black font-bold">새 시즌</button>
              </div>
            ) : oppId ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-5">
                <div className="text-xs text-white/60">{label}</div>
                <div className="flex items-center justify-center gap-4 my-4 text-xl font-black">
                  <span style={{ color: user.accent }}>{user.short}</span>
                  <span className="text-white/40">vs</span>
                  <span style={{ color: teamById(oppId).accent }}>{teamById(oppId).short}</span>
                </div>
                <div className="text-xs text-white/60 mb-2">선발 투수</div>
                <div className="flex flex-wrap gap-1 mb-4">
                  {user.rotation.map((p, i) => (
                    <button key={i} onClick={() => update({ ...L, starterIdx: i })}
                      className={`px-2 py-1 rounded text-xs border ${L.starterIdx === i ? "bg-yellow-400 text-black border-yellow-300 font-bold" : "bg-white/5 border-white/10"}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPlaying(true)} className="flex-1 py-3 rounded-lg bg-yellow-400 text-black font-black">▶ 직접 플레이</button>
                  <button onClick={simUser} className="px-4 py-3 rounded-lg bg-white/10 font-bold text-sm">자동 진행</button>
                </div>
                {L.stage === "regular" && (
                  <button onClick={() => { if (confirm("남은 정규시즌을 모두 자동 진행할까요?")) autoSim(); }} className="w-full mt-2 py-2 text-xs rounded bg-white/5 text-white/70">정규시즌 끝까지 자동 진행</button>
                )}
              </div>
            ) : series ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
                <div className="text-sm text-white/70 mb-2">우리 팀은 이 시리즈에 진출하지 못했습니다.</div>
                <div className="font-black">{SERIES_LABEL[series.kind]}: {teamById(series.high).short} {series.wHigh} - {series.wLow} {teamById(series.low).short}</div>
                <button onClick={simUser} className="mt-3 px-5 py-2 rounded bg-yellow-400 text-black font-bold">다음 경기 진행</button>
              </div>
            ) : null}

            {L.post.length > 0 && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-sm font-bold mb-2">포스트시즌</div>
                {L.post.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-white/5">
                    <span className="text-white/60">{SERIES_LABEL[s.kind]}</span>
                    <span className={s.winner ? "" : "text-yellow-300"}>{teamById(s.high).short} {s.wHigh} : {s.wLow} {teamById(s.low).short}{s.winner ? ` → ${teamById(s.winner).short}` : ""}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { if (confirm("리그를 초기화할까요?")) setSaved(null); }} className="text-xs text-white/40 underline">리그 초기화</button>
          </div>
        )}

        {tab === "lineup" && (
          <LineupEditor team={user} slots={lineup} onChange={(lineup) => setSaved({ ...saved, lineup })} />
        )}
        {tab === "market" && <MarketTab market={market} user={L.userTeamId} onChange={setMarket} />}
        {tab === "trade" && <TradeTab market={market} user={L.userTeamId} onChange={setMarket} />}
        {tab === "teams" && <TeamsTab market={market} user={L.userTeamId} onChange={setMarket} />}

        {tab === "standings" && (
          <table className="w-full text-sm">
            <thead className="text-white/50 text-xs"><tr><th className="text-left py-1">순위</th><th className="text-left">팀</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>승률</th><th>게임차</th></tr></thead>
            <tbody>
              {rank.map((s, i) => (
                <tr key={s.id} className={`border-t border-white/5 text-center ${s.id === L.userTeamId ? "bg-yellow-400/15 font-bold" : ""}`}>
                  <td className="text-left py-1.5">{i + 1}{i < 5 && <span className="ml-1 text-[9px] text-emerald-300">PS</span>}</td>
                  <td className="text-left">{teamById(s.id).short}</td>
                  <td>{s.w + s.l + s.d}</td><td>{s.w}</td><td>{s.l}</td><td>{s.d}</td>
                  <td>{winPct(s).toFixed(3).replace(/^0/, "")}</td>
                  <td>{i === 0 ? "-" : gamesBehind(rank[0]!, s).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "news" && (
          <div className="space-y-1 text-sm">
            {market.news.length + L.news.length === 0 && <div className="text-white/50">아직 소식이 없습니다.</div>}
            {[...market.news, ...L.news].map((n, i) => <div key={i} className="px-3 py-2 rounded bg-white/5">{n}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueSetup({ onExit, onCreate }: { onExit: () => void; onCreate: (t: Team, innings: number) => void }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [inn, setInn] = useState(3);
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-stone-950 text-white px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={onExit} className="text-xs px-3 py-1.5 rounded bg-white/10 mb-4">← 메뉴</button>
        <h1 className="text-3xl font-black mb-1">리그 모드</h1>
        <p className="text-sm text-white/60 mb-6">구단을 고르세요. 10개 구단 라운드로빈 후 상위 5팀이 가을야구에 진출합니다.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {TEAMS.map((t) => (
            <button key={t.id} onClick={() => setTeam(t)} className="rounded-xl p-3 text-left border-2"
              style={{ background: t.color, borderColor: team?.id === t.id ? t.accent : "transparent" }}>
              <div className="text-xs opacity-80">{t.short}</div>
              <div className="font-bold">{t.name}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-6">
          <span className="text-xs text-white/60">경기 이닝</span>
          {[3, 6, 9].map((n) => (
            <button key={n} onClick={() => setInn(n)} className={`px-4 py-2 rounded text-sm font-bold ${inn === n ? "bg-yellow-400 text-black" : "bg-white/5"}`}>{n}이닝</button>
          ))}
        </div>
        <button disabled={!team} onClick={() => team && onCreate(team, inn)} className="mt-6 px-8 py-3 rounded-lg bg-yellow-400 text-black font-black disabled:opacity-40">시즌 시작 →</button>
      </div>
    </div>
  );
}

function LineupEditor({ team, slots, onChange }: { team: Team; slots: LineupSlot[]; onChange: (s: LineupSlot[]) => void }) {
  const used = new Set(slots.map((s) => s.name));
  const bench = team.lineup.filter((b) => !used.has(b.name));
  const setSlot = (i: number, patch: Partial<LineupSlot>) => {
    const next = slots.map((s, j) => (j === i ? { ...s, ...patch } : s));
    // 포지션 중복 시 맞교환
    if (patch.pos) {
      const dup = slots.findIndex((s, j) => j !== i && s.pos === patch.pos);
      if (dup >= 0) next[dup] = { ...next[dup]!, pos: slots[i]!.pos };
    }
    onChange(next);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= slots.length) return;
    const next = [...slots];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div>
      <div className="text-xs text-white/60 mb-3">타순과 수비 위치를 정하세요. 원래 포지션이 아니면 정확·파워가 1씩 내려갑니다 (지명타자 제외).</div>
      <div className="space-y-1.5">
        {slots.map((s, i) => {
          const b = team.lineup.find((x) => x.name === s.name)!;
          const off = s.pos !== "DH" && s.pos !== b.pos;
          return (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5">
              <div className="w-5 text-center font-black text-yellow-300">{i + 1}</div>
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} className="text-[10px] leading-none px-1">▲</button>
                <button onClick={() => move(i, 1)} className="text-[10px] leading-none px-1">▼</button>
              </div>
              <select value={s.name} onChange={(e) => setSlot(i, { name: e.target.value })} className="flex-1 min-w-0 bg-black/40 rounded px-1 py-1 text-sm">
                <option value={s.name}>{s.name} ({POS_LABEL[b.pos]})</option>
                {bench.map((x) => <option key={x.name} value={x.name}>{x.name} ({POS_LABEL[x.pos]})</option>)}
              </select>
              <select value={s.pos} onChange={(e) => setSlot(i, { pos: e.target.value as Position })} className={`bg-black/40 rounded px-1 py-1 text-sm ${off ? "text-rose-300" : "text-emerald-300"}`}>
                {FIELD.map((p) => <option key={p} value={p}>{POS_LABEL[p]}</option>)}
              </select>
              <div className="text-[10px] w-20 text-right text-white/60">정{b.contact} 파{b.power} 수{fieldingAt(b, s.pos)}<div className="text-yellow-200/80">{fmtMoney(batterValue(b))}</div>{off && <div className="text-rose-300">타격-1 수비-2</div>}</div>
            </div>
          );
        })}
      </div>
      <button onClick={() => onChange(defaultLineup(team))} className="mt-3 text-xs px-3 py-1.5 rounded bg-white/10">기본 라인업으로</button>
    </div>
  );
}
