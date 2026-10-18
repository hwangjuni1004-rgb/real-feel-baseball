import { useState } from "react";
import { UserRound, UserRoundPlus, UserRoundMinus } from "lucide-react";
import { Button } from "./ui/button";
import { STAFF, STAFF_ROLES, changeStaff, staffBonus, staffMembers, type StaffMember, type StaffState } from "@/lib/staff";
import type { MarketState } from "@/lib/market";

function effect(s: StaffMember) {
  const n = s.bonus;
  return s.role === "manager" ? `정확 +${n} · 제구 +${n}` : s.role === "batting" ? `정확 +${n} · 파워 +${n}` : s.role === "pitching" ? `제구 +${n}` : `수비 +${n}`;
}
export function StaffTab({ market, staff, user, onChange }: { market: MarketState; staff: StaffState; user: string; onChange: (market: MarketState, staff: StaffState) => void }) {
  const [message, setMessage] = useState("");
  const own = staffMembers(staff, user);
  const b = staffBonus(staff, user);
  const available = STAFF.filter(s => !Object.values(staff).some(ids => ids.includes(s.id)));
  const act = (id: string, action: "hire" | "release") => {
    const r = changeStaff(market, staff, user, id, action);
    setMessage(r.message);
    if (r.ok) onChange(r.market, r.staff);
  };
  return <section className="league-staff text-foreground space-y-5">
    <header className="flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">감독·코치진</h2><p className="text-xs text-muted-foreground mt-1">가상 인물 · 게임 내 계약 금액</p></div>
      <UserRound className="size-7 text-primary" />
    </header>
    <div className="grid grid-cols-4 gap-2 border-y border-border py-3 text-center text-sm" aria-label="코치진 능력 보정">
      {[["정확", b.contact], ["파워", b.power], ["제구", b.control], ["수비", b.defense]].map(([label, value]) => <div key={label}><span className="block text-xs text-muted-foreground">{label}</span><strong className="text-primary">+{value}</strong></div>)}
    </div>
    {message && <p role="status" className="border-l-2 border-primary pl-3 text-sm">{message}</p>}
    <div><h3 className="font-bold mb-2">우리 팀 코치진 <span className="text-muted-foreground">{own.length}/4</span></h3>
      {own.length === 0 && <p className="text-sm text-muted-foreground py-3">계약한 감독·코치가 없습니다.</p>}
      <div className="grid gap-2 sm:grid-cols-2">{own.map(s => <article key={s.id} className="rounded-lg border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">{STAFF_ROLES[s.role]}</div><div className="font-bold mt-1">{s.name}</div><p className="text-sm text-primary my-2">{effect(s)}</p>
        <Button variant="secondary" size="sm" onClick={() => act(s.id, "release")}><UserRoundMinus />방출 · {(s.price / 2).toLocaleString()}만 달러 회수</Button>
      </article>)}</div>
    </div>
    <div><h3 className="font-bold mb-2">영입 후보</h3><div className="grid gap-2 sm:grid-cols-2">{available.map(s => {
      const occupied = own.some(p => p.role === s.role);
      const insufficient = (market.money[user] ?? 0) < s.price;
      return <article key={s.id} className="rounded-lg border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">{STAFF_ROLES[s.role]}</div><div className="font-bold mt-1">{s.name}</div><p className="text-sm text-primary my-2">{effect(s)}</p>
        <div className="text-sm mb-3">{s.price.toLocaleString()}만 달러</div>
        <Button size="sm" disabled={occupied || insufficient} onClick={() => act(s.id, "hire")} aria-label={`${s.name} 영입`}><UserRoundPlus />{occupied ? "보직 계약 중" : insufficient ? "자금 부족" : "영입"}</Button>
      </article>;
    })}</div></div>
  </section>;
}