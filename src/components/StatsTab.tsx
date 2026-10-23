import { useState } from "react";
import { TEAMS, POS_LABEL } from "@/lib/kbo-data";
import { teamWithRoster, type MarketState } from "@/lib/market";
import { batAvg, era, fmtAvg, formatIP, type BatterStat, type PitcherStat, type SeasonStats } from "@/lib/stats";

type Detail =
  | { kind: "batter"; name: string; pos: string; stat: BatterStat }
  | { kind: "pitcher"; name: string; stat: PitcherStat };

export function StatsTab({ stats, market, user }: { stats: SeasonStats; market: MarketState; user: string }) {
  const [teamId, setTeamId] = useState(user);
  const [detail, setDetail] = useState<Detail | null>(null);
  const team = teamWithRoster(TEAMS.find((t) => t.id === teamId)!, market);
  const ts = stats[teamId];

  const batters = Object.entries(ts?.batters ?? {})
    .filter(([, s]) => s.pa > 0)
    .sort((a, b) => batAvg(b[1]) - batAvg(a[1]));
  const pitchers = Object.entries(ts?.pitchers ?? {})
    .filter(([, s]) => s.outs > 0 || s.w + s.l + s.hld + s.sv > 0)
    .sort((a, b) => era(a[1]) - era(b[1]));
  const posOf = (name: string) => team.lineup.find((b) => b.name === name)?.pos;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto">
        {TEAMS.map((t) => (
          <button key={t.id} onClick={() => { setTeamId(t.id); setDetail(null); }}
            className={`shrink-0 px-3 py-1.5 rounded text-xs font-bold ${teamId === t.id ? "bg-yellow-400 text-black" : "bg-white/5"}`}>
            {t.short}
          </button>
        ))}
      </div>

      {batters.length + pitchers.length === 0 && (
        <div className="text-white/50 text-sm">아직 기록이 없습니다. 직접 플레이한 경기부터 기록이 쌓입니다.</div>
      )}

      {batters.length > 0 && (
        <div>
          <div className="text-sm font-bold mb-1">타자</div>
          <table className="w-full text-xs">
            <thead className="text-white/50">
              <tr><th className="text-left py-1">이름</th><th className="text-left">포지션</th><th>타율</th><th>타석</th><th>안타</th><th>홈런</th><th>타점</th><th>볼넷</th><th>삼진</th></tr>
            </thead>
            <tbody>
              {batters.map(([name, s]) => (
                <tr key={name} onClick={() => setDetail({ kind: "batter", name, pos: posOf(name) ? POS_LABEL[posOf(name)!] : "-", stat: s })}
                  className="border-t border-white/5 text-center cursor-pointer hover:bg-white/5">
                  <td className="text-left py-1.5 font-semibold">{name}</td>
                  <td className="text-left text-white/60">{posOf(name) ? POS_LABEL[posOf(name)!] : "-"}</td>
                  <td className="text-yellow-200 font-bold">{fmtAvg(batAvg(s))}</td>
                  <td>{s.pa}</td><td>{s.h}</td><td>{s.hr}</td><td>{s.rbi}</td><td>{s.bb}</td><td>{s.so}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pitchers.length > 0 && (
        <div>
          <div className="text-sm font-bold mb-1">투수</div>
          <table className="w-full text-xs">
            <thead className="text-white/50">
              <tr><th className="text-left py-1">이름</th><th>방어율</th><th>이닝</th><th>실점</th><th>승</th><th>패</th><th>홀드</th><th>세이브</th></tr>
            </thead>
            <tbody>
              {pitchers.map(([name, s]) => (
                <tr key={name} onClick={() => setDetail({ kind: "pitcher", name, stat: s })}
                  className="border-t border-white/5 text-center cursor-pointer hover:bg-white/5">
                  <td className="text-left py-1.5 font-semibold">{name}</td>
                  <td className="text-yellow-200 font-bold">{era(s).toFixed(2)}</td>
                  <td>{formatIP(s.outs)}</td><td>{s.er}</td><td>{s.w}</td><td>{s.l}</td><td>{s.hld}</td><td>{s.sv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-sm rounded-xl bg-stone-900 border border-white/15 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline gap-2 mb-1">
              <div className="text-xl font-black">{detail.name}</div>
              <div className="text-xs text-white/50">{team.name}{detail.kind === "batter" ? ` · ${detail.pos}` : " · 투수"}</div>
            </div>
            <div className="text-[11px] text-white/40 mb-4">이번 시즌 기록 (직접 플레이한 경기 기준)</div>
            {detail.kind === "batter" ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                {([
                  ["타율", fmtAvg(batAvg(detail.stat))],
                  ["타석", detail.stat.pa],
                  ["타수", detail.stat.ab],
                  ["안타", detail.stat.h],
                  ["홈런", detail.stat.hr],
                  ["타점", detail.stat.rbi],
                  ["볼넷", detail.stat.bb],
                  ["삼진", detail.stat.so],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 py-2">
                    <div className="text-[10px] text-white/50">{k}</div>
                    <div className="font-black text-yellow-200">{v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                {([
                  ["방어율", era(detail.stat).toFixed(2)],
                  ["이닝", formatIP(detail.stat.outs)],
                  ["실점", detail.stat.er],
                  ["승", detail.stat.w],
                  ["패", detail.stat.l],
                  ["홀드", detail.stat.hld],
                  ["세이브", detail.stat.sv],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 py-2">
                    <div className="text-[10px] text-white/50">{k}</div>
                    <div className="font-black text-yellow-200">{v}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setDetail(null)} className="mt-4 w-full py-2 rounded bg-white/10 text-sm font-bold">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
