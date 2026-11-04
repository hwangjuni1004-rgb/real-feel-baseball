import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import type { MarketState } from "@/lib/market";
import { MAX_BATTERS_1, MAX_PITCHERS_1, demote, getFarm, promote, recallIn, type Kind } from "@/lib/farm";
import { batterValue, pitcherValue, type Batter, type Pitcher } from "@/lib/kbo-data";

const bLine = (b: Batter) => `${b.pos} · 정확 ${b.contact} 파워 ${b.power}`;
const pLine = (p: Pitcher) => `${p.velo}km · 제구 ${p.control}`;

export function FarmTab({ market, user, starters, onChange }: { market: MarketState; user: string; starters: string[]; onChange: (m: MarketState) => void }) {
  const [message, setMessage] = useState("");
  const r = market.rosters[user];
  const f = getFarm(market, user);
  if (!r) return null;
  const act = (fn: typeof demote, kind: Kind, name: string) => {
    const res = fn(market, user, kind, name);
    if (res.ok) { setMessage(res.message); onChange(res.market); } else setMessage(res.error);
  };
  const row = (key: string, name: string, info: string, value: number, action: React.ReactNode) => (
    <div key={key} className="flex items-center gap-2 rounded bg-white/5 px-3 py-2 text-sm">
      <div className="flex-1 min-w-0"><div className="font-bold truncate">{name}</div><div className="text-xs text-white/60">{info} · {value.toLocaleString()}만$</div></div>
      {action}
    </div>
  );
  const down = (kind: Kind, name: string, locked: boolean) => (
    <Button size="sm" variant="secondary" disabled={locked} onClick={() => act(demote, kind, name)} title={locked ? "선발 라인업에서 먼저 빼주세요" : undefined}>
      <ArrowDown />{locked ? "주전" : "2군"}
    </Button>
  );
  const up = (kind: Kind, name: string, wait: number) => (
    <Button size="sm" disabled={wait > 0} onClick={() => act(promote, kind, name)}><ArrowUp />{wait > 0 ? `${wait}경기 뒤` : "1군"}</Button>
  );
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">1군 · 2군</h2>
        <p className="text-xs text-white/60 mt-1">1군 타자 최대 {MAX_BATTERS_1}명, 투수 최대 {MAX_PITCHERS_1}명. 2군으로 내린 선수는 3경기 뒤에 다시 올릴 수 있고, 2군에서 조금씩 성장합니다.</p>
      </div>
      {message && <p role="status" className="border-l-2 border-yellow-400 pl-3 text-sm">{message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-bold">1군 타자 <span className="text-white/50">{r.lineup.length}/{MAX_BATTERS_1}</span></h3>
          {r.lineup.map((b) => row("1b" + b.name, b.name, bLine(b), batterValue(b), down("B", b.name, starters.includes(b.name))))}
          <h3 className="font-bold pt-2">1군 투수 <span className="text-white/50">{r.rotation.length}/{MAX_PITCHERS_1}</span></h3>
          {r.rotation.map((p, i) => row("1p" + p.name, (i < 5 ? "선발 " : "") + p.name, pLine(p), pitcherValue(p), down("P", p.name, false)))}
        </div>
        <div className="space-y-2">
          <h3 className="font-bold">2군 타자 <span className="text-white/50">{f.batters.length}</span></h3>
          {f.batters.length === 0 && <div className="text-sm text-white/50">없음</div>}
          {f.batters.map((e) => row("2b" + e.player.name, e.player.name, bLine(e.player), batterValue(e.player), up("B", e.player.name, recallIn(market, e))))}
          <h3 className="font-bold pt-2">2군 투수 <span className="text-white/50">{f.pitchers.length}</span></h3>
          {f.pitchers.length === 0 && <div className="text-sm text-white/50">없음</div>}
          {f.pitchers.map((e) => row("2p" + e.player.name, e.player.name, pLine(e.player), pitcherValue(e.player), up("P", e.player.name, recallIn(market, e))))}
        </div>
      </div>
    </section>
  );
}
