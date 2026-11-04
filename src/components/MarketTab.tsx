import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scoutListings, type ScoutPlayer } from "@/lib/scouting.functions";
import { TEAMS, POS_LABEL, batterValue, batterDefense, pitcherValue, fmtMoney } from "@/lib/kbo-data";
import {
  placeBid, directOffer, listOwn, cancelListing, valueRange, listingName, listingTeam,
  type MarketState,
} from "@/lib/market";

const SCOUT_KEY = "kbo-scout-reports";
function loadScout(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SCOUT_KEY) || "{}"); } catch { return {}; }
}

/** 이번 접속에서 이미 요청한 매물 (탭 재마운트 시 중복 요청 방지) */
const ASKED = new Set<string>();

function useScouting(market: MarketState, user: string) {
  const run = useServerFn(scoutListings);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(ASKED);
  useEffect(() => { setReports(loadScout()); }, []);
  const targets = market.listings.filter((l) => !l.userListed);
  const missing = targets.filter((l) => !reports[l.id] && !asked.current.has(l.id));
  const fetchMissing = async (force = false) => {
    const list = targets.filter((l) => !reports[l.id] && (force || !asked.current.has(l.id)));
    if (!list.length) return;
    list.forEach((l) => asked.current.add(l.id));
    setLoading(true); setError(null);
    const players: ScoutPlayer[] = list.map((l) => ({
      id: l.id, name: listingName(l), from: listingTeam(l.from), value: l.value,
      role: l.batter ? POS_LABEL[l.batter.pos] : "투수",
      hand: l.batter ? `${l.batter.bats}타` : `${l.pitcher!.throws}투`,
      stats: l.batter
        ? `파워${l.batter.power} 정확${l.batter.contact} 주력${l.batter.speed ?? 5} 수비${batterDefense(l.batter)}`
        : `최고구속${l.pitcher!.velo}km 제구${l.pitcher!.control} 구종:${l.pitcher!.pitches.map((x) => x.name).join("/")}`,
    }));
    try {
      const res = await run({ data: { players } });
      if (res.error) setError(res.error);
      setReports((prev) => {
        const live = new Set(market.listings.map((l) => l.id));
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries({ ...prev, ...res.reports })) if (live.has(k)) next[k] = v;
        localStorage.setItem(SCOUT_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      setError("스카우팅 리포트를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  };
  const missingKey = missing.map((l) => l.id).join(",");
  useEffect(() => { if (missingKey) void fetchMissing(); }, [missingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return { reports, loading, error, retry: () => fetchMissing(true) };
}

type P = { market: MarketState; user: string; onChange: (m: MarketState) => void };

function OfferBox({ onSubmit, init }: { onSubmit: (v: number) => void; init: number }) {
  const [v, setV] = useState(String(init));
  return (
    <div className="flex gap-1 mt-1">
      <input value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
        className="w-24 bg-black/40 rounded px-1 py-1 text-xs" />
      <span className="text-[10px] self-center text-white/50">만$</span>
      <button onClick={() => Number(v) > 0 && onSubmit(Number(v))} className="px-2 py-1 rounded bg-yellow-400 text-black text-xs font-bold">오퍼</button>
    </div>
  );
}

export function MarketTab({ market, user, onChange }: P) {
  const mine = market.rosters[user]!;
  const listedNames = new Set(market.listings.map(listingName));
  const scout = useScouting(market, user);
  return (
    <div className="space-y-4">
      <div className="text-xs text-white/60">오퍼는 {3}경기 뒤 체결됩니다. 여러 팀이 원하면 금액이 높을수록 데려갈 확률이 큽니다.</div>
      {scout.loading && <div className="text-[11px] text-sky-300">🔍 스카우터가 매물 리포트를 쓰는 중…</div>}
      {scout.error && !scout.loading && (
        <div className="text-[11px] text-rose-300">{scout.error} <button onClick={scout.retry} className="underline">다시 시도</button></div>
      )}
      <div className="space-y-2">
        {market.listings.filter((l) => !l.userListed).map((l) => {
          const pl = (l.batter ?? l.pitcher)!;
          const [lo, hi] = valueRange(l.value);
          const myBid = l.bids.find((b) => b.team === user);
          return (
            <div key={l.id} className={`rounded-lg p-2 border ${l.from === "MLB" ? "border-yellow-300/60 bg-yellow-400/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex justify-between text-sm">
                <span className="font-bold">{pl.name} <span className="text-[10px] text-white/50">{listingTeam(l.from)} · {l.batter ? POS_LABEL[l.batter.pos] : "투수"}{l.direct ? " · 직접 오퍼" : ""}</span></span>
                <span className="text-[10px] text-white/50">{Math.max(0, l.closesAt - market.gameNo)}경기 후 마감</span>
              </div>
              <div className="text-[11px] text-white/60">
                {l.batter ? `정${l.batter.contact} 파${l.batter.power}` : `구속${l.pitcher!.velo} 제구${l.pitcher!.control}`} · 예상가치 {fmtMoney(lo)}~{fmtMoney(hi)} · 입찰 {l.bids.length}팀
              </div>
              {scout.reports[l.id] && (
                <div className="mt-1 text-[11px] leading-snug text-sky-100 bg-sky-400/10 border-l-2 border-sky-300/60 rounded px-2 py-1">
                  <span className="font-bold text-sky-300">스카우팅</span> {scout.reports[l.id]}
                </div>
              )}
              {myBid && <div className="text-[11px] text-emerald-300">내 오퍼 {fmtMoney(myBid.amount)}</div>}
              {!l.direct && <OfferBox init={l.value} onSubmit={(v) => onChange(placeBid(market, user, l.id, v))} />}
            </div>
          );
        })}
      </div>
      <div>
        <div className="font-bold text-sm mb-1">내 선수 매물 등록</div>
        {market.listings.filter((l) => l.userListed).map((l) => (
          <div key={l.id} className="flex justify-between text-xs px-2 py-1 rounded bg-yellow-400/10 mb-1">
            <span>{listingName(l)} · 입찰 {l.bids.length}팀 · {Math.max(0, l.closesAt - market.gameNo)}경기 후</span>
            <button onClick={() => onChange(cancelListing(market, l.id))} className="text-rose-300">취소</button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-1">
          {[...mine.lineup.map((b) => ({ n: b.name, v: batterValue(b), t: POS_LABEL[b.pos] })), ...mine.rotation.map((p) => ({ n: p.name, v: pitcherValue(p), t: "투수" }))]
            .filter((x) => !listedNames.has(x.n)).map((x) => (
              <button key={x.n} onClick={() => onChange(listOwn(market, user, x.n))} className="text-left text-xs px-2 py-1 rounded bg-white/5">
                {x.n} <span className="text-white/50">{x.t} · {fmtMoney(x.v)}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export function TeamsTab({ market, user, onChange }: P) {
  const others = TEAMS.filter((t) => t.id !== user);
  const [tid, setTid] = useState(others[0]!.id);
  const [sel, setSel] = useState<string | null>(null);
  const r = market.rosters[tid]!;
  const rows = [...r.lineup.map((b) => ({ n: b.name, v: batterValue(b), t: `${POS_LABEL[b.pos]} · 정${b.contact} 파${b.power}` })),
    ...r.rotation.map((p) => ({ n: p.name, v: pitcherValue(p), t: `투수 · ${p.velo}km 제구${p.control}` }))];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {others.map((t) => (
          <button key={t.id} onClick={() => { setTid(t.id); setSel(null); }} className={`px-2 py-1 rounded text-xs ${tid === t.id ? "bg-yellow-400 text-black font-bold" : "bg-white/5"}`}>{t.short}</button>
        ))}
      </div>
      <div className="text-[11px] text-white/50 mb-2">직접 오퍼는 성공률이 낮습니다. 금액을 높일수록 확률이 오릅니다. 자금 {(market.money[tid] ?? 0).toLocaleString()}만$</div>
      <div className="space-y-1">
        {rows.map((x) => (
          <div key={x.n} className="rounded bg-white/5 px-2 py-1.5">
            <button onClick={() => setSel(sel === x.n ? null : x.n)} className="w-full flex justify-between text-sm">
              <span>{x.n} <span className="text-[10px] text-white/50">{x.t}</span></span>
              <span className="text-[11px] text-yellow-200">{fmtMoney(x.v)}</span>
            </button>
            {sel === x.n && <OfferBox init={Math.round(x.v * 1.3)} onSubmit={(v) => { onChange(directOffer(market, user, tid, x.n, v)); setSel(null); }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
