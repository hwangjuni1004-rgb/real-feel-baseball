import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { TEAMS, POS_LABEL } from "@/lib/kbo-data";
import { teamWithRoster, type MarketState } from "@/lib/market";
import { batAvg, era, fmtAvg, formatIP, type BatterStat, type PitcherStat, type SeasonStats } from "@/lib/stats";

type Detail =
  | { kind: "batter"; name: string; pos: string; stat: BatterStat }
  | { kind: "pitcher"; name: string; stat: PitcherStat };

export function StatsTab({ stats, market, user }: { stats: SeasonStats; market: MarketState; user: string }) {
  const [teamId, setTeamId] = useState(user);
  const [detail, setDetail] = useState<Detail | null>(null);
  const baseTeam = TEAMS.find((t) => t.id === teamId);
  if (!baseTeam) return null;
  const team = teamWithRoster(baseTeam, market);
  const ts = stats[teamId];

  const batters = Object.entries(ts?.batters ?? {})
    .filter(([, s]) => s.pa > 0)
    .sort((a, b) => batAvg(b[1]) - batAvg(a[1]));
  const pitchers = Object.entries(ts?.pitchers ?? {})
    .filter(([, s]) => s.outs > 0 || s.w + s.l + s.hld + s.sv > 0)
    .sort((a, b) => era(a[1]) - era(b[1]));
  const posOf = (name: string) => {
    const pos = team.lineup.find((b) => b.name === name)?.pos;
    return pos ? POS_LABEL[pos] : "-";
  };

  return (
    <div className="league-stats space-y-4 text-foreground">
      <p className="text-xs text-muted-foreground">이번 시즌 · 직접 경기 기록</p>
      <div className="flex gap-1 overflow-x-auto">
        {TEAMS.map((t) => (
          <Button variant="ghost" aria-pressed={teamId === t.id} key={t.id} onClick={() => { setTeamId(t.id); setDetail(null); }}
            className={`shrink-0 px-3 py-1.5 rounded text-xs font-bold ${teamId === t.id ? "bg-primary text-primary-foreground" : "bg-secondary/50"}`}>
            {t.short}
          </Button>
        ))}
      </div>

      {batters.length + pitchers.length === 0 && (
        <div className="text-muted-foreground text-sm">아직 기록이 없습니다.</div>
      )}

      {batters.length > 0 && (
        <div className="overflow-x-auto">
          <div className="text-sm font-bold mb-1">타자</div>
          <table className="w-full min-w-[520px] text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left py-1">이름</th><th className="text-left">포지션</th><th>타율</th><th>타석</th><th>안타</th><th>홈런</th><th>타점</th><th>볼넷</th><th>삼진</th></tr>
            </thead>
            <tbody>
              {batters.map(([name, s]) => (
                <tr key={name}
                  className="border-t border-border text-center cursor-pointer hover:bg-secondary/50">
                  <td className="text-left py-1.5 font-semibold"><Button variant="ghost" className="h-auto px-0 py-1 text-xs" onClick={() => setDetail({ kind: "batter", name, pos: posOf(name), stat: s })}>{name}</Button></td>
                  <td className="text-left text-muted-foreground">{posOf(name)}</td>
                  <td className="text-primary font-bold">{fmtAvg(batAvg(s))}</td>
                  <td>{s.pa}</td><td>{s.h}</td><td>{s.hr}</td><td>{s.rbi}</td><td>{s.bb}</td><td>{s.so}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pitchers.length > 0 && (
        <div className="overflow-x-auto">
          <div className="text-sm font-bold mb-1">투수</div>
          <table className="w-full min-w-[520px] text-xs">
            <thead className="text-muted-foreground">
              <tr><th className="text-left py-1">이름</th><th>방어율</th><th>이닝</th><th>실점</th><th>승</th><th>패</th><th>홀드</th><th>세이브</th></tr>
            </thead>
            <tbody>
              {pitchers.map(([name, s]) => (
                <tr key={name}
                  className="border-t border-border text-center cursor-pointer hover:bg-secondary/50">
                  <td className="text-left py-1.5 font-semibold"><Button variant="ghost" className="h-auto px-0 py-1 text-xs" onClick={() => setDetail({ kind: "pitcher", name, stat: s })}>{name}</Button></td>
                  <td className="text-primary font-bold">{era(s).toFixed(2)}</td>
                  <td>{formatIP(s.outs)}</td><td>{s.er}</td><td>{s.w}</td><td>{s.l}</td><td>{s.hld}</td><td>{s.sv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}>
          <DialogContent className="league-stats w-[calc(100%-2rem)] max-w-sm rounded-lg border-border bg-card text-foreground">
            <div className="flex items-baseline gap-2 mb-1">
              <DialogTitle className="text-xl font-black">{detail.name}</DialogTitle>
              <div className="text-xs text-muted-foreground">{team.name}{detail.kind === "batter" ? ` · ${detail.pos}` : " · 투수"}</div>
            </div>
            <DialogDescription className="text-[11px] text-muted-foreground">이번 시즌 · 직접 경기 기록</DialogDescription>
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
                  <div key={k} className="rounded-lg bg-secondary/50 py-2">
                    <div className="text-[10px] text-muted-foreground">{k}</div>
                    <div className="font-black text-primary">{v}</div>
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
                  <div key={k} className="rounded-lg bg-secondary/50 py-2">
                    <div className="text-[10px] text-muted-foreground">{k}</div>
                    <div className="font-black text-primary">{v}</div>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" onClick={() => setDetail(null)} className="mt-4 w-full">닫기</Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
