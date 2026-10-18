import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "./ui/button";
import { TEAMS, POS_LABEL, fmtMoney } from "@/lib/kbo-data";
import { type MarketState, type Roster } from "@/lib/market";
import { evaluateTrade, proposeTrade, tradePlayers, tradeValue, type TradePlayer } from "@/lib/trade";

const keyOf = (p: TradePlayer) => `${p.kind}:${p.name}`;
function PlayerSelect({ roster, value, onChange, label }: { roster: Roster; value: string; onChange: (v: string) => void; label: string }) {
  return <label className="block min-w-0 space-y-2 text-sm">
    <span className="font-bold">{label}</span>
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 rounded-md border border-border bg-background p-2 text-foreground">
      <option value="">선수 선택</option>
      {tradePlayers(roster).map((p) => {
        const batter = p.kind === "B" ? roster.lineup.find((b) => b.name === p.name) : undefined;
        return <option key={keyOf(p)} value={keyOf(p)}>{p.name} · {batter ? POS_LABEL[batter.pos] : "투수"} · {fmtMoney(tradeValue(roster, p))}</option>;
      })}
    </select>
  </label>;
}

export function TradeTab({ market, user, onChange }: { market: MarketState; user: string; onChange: (m: MarketState) => void }) {
  const others = TEAMS.filter((t) => t.id !== user);
  const [other, setOther] = useState(others[0]?.id ?? "");
  const [giveKey, setGive] = useState("");
  const [receiveKey, setReceive] = useState("");
  const [message, setMessage] = useState("");
  const own = market.rosters[user]; const theirs = market.rosters[other];
  if (!own || !theirs) return null;
  const give = tradePlayers(own).find((p) => keyOf(p) === giveKey);
  const receive = tradePlayers(theirs).find((p) => keyOf(p) === receiveKey);
  const proposal = give && receive ? { user, other, give, receive } : undefined;
  const assessment = proposal ? evaluateTrade(market, proposal) : undefined;
  return <section className="dark text-foreground space-y-5">
    <h2 className="flex items-center gap-2 text-lg font-bold"><ArrowLeftRight aria-hidden="true" />트레이드</h2>
    <div className="flex flex-wrap gap-1" aria-label="상대 구단">
      {others.map((t) => <Button key={t.id} size="sm" variant={other === t.id ? "default" : "secondary"} aria-pressed={other === t.id}
        onClick={() => { setOther(t.id); setReceive(""); setMessage(""); }}>{t.short}</Button>)}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <PlayerSelect roster={own} value={give ? giveKey : ""} onChange={(v) => { setGive(v); setMessage(""); }} label="보낼 우리 선수" />
      <PlayerSelect roster={theirs} value={receive ? receiveKey : ""} onChange={(v) => { setReceive(v); setMessage(""); }} label="데려올 상대 선수" />
    </div>
    {give && receive && <div className="border-y border-border py-3 space-y-2 text-sm">
      <div className="break-words font-bold">{give.name} ↔ {receive.name}</div>
      <div className="flex flex-wrap justify-between gap-2 text-muted-foreground"><span>제안 가치 {fmtMoney(tradeValue(own, give))}</span><span>상대 선수 가치 {fmtMoney(tradeValue(theirs, receive))}</span></div>
      <div>{assessment?.reason}</div>
      {assessment?.valid && <div className="font-bold">예상 수락 확률 {Math.round(assessment.probability * 100)}%</div>}
    </div>}
    <Button disabled={!assessment?.valid} onClick={() => {
      if (!proposal) return;
      const result = proposeTrade(market, proposal);
      onChange(result.market); setMessage(result.message);
      if (result.accepted) { setGive(""); setReceive(""); }
    }}><ArrowLeftRight aria-hidden="true" />트레이드 제안</Button>
    {message && <p role="status" className="break-words border-l-2 border-primary pl-3 text-sm">{message}</p>}
  </section>;
}