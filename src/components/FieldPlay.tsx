import { useEffect, useMemo, useRef, useState } from "react";

export type BattedKind = "fly" | "ground" | "line" | "homer";
/** 실제 경기 결과 — 연출의 아웃/세이프 판정은 반드시 이 값과 일치한다 */
export type BattedOutcome = "out" | "single" | "double" | "triple" | "homer";

type Pos = { x: number; y: number };

const POSITIONS: { key: string; label: string; pos: Pos; infield: boolean }[] = [
  { key: "P", label: "투", pos: { x: 50, y: 58 }, infield: true },
  { key: "C", label: "포", pos: { x: 50, y: 93 }, infield: true },
  { key: "1B", label: "1루", pos: { x: 70, y: 55 }, infield: true },
  { key: "2B", label: "2루", pos: { x: 61, y: 43 }, infield: true },
  { key: "SS", label: "유격", pos: { x: 39, y: 43 }, infield: true },
  { key: "3B", label: "3루", pos: { x: 30, y: 55 }, infield: true },
  { key: "LF", label: "좌익", pos: { x: 17, y: 18 }, infield: false },
  { key: "CF", label: "중견", pos: { x: 50, y: 10 }, infield: false },
  { key: "RF", label: "우익", pos: { x: 83, y: 18 }, infield: false },
];

/** 다이아몬드: 홈(아래) → 1루(우) → 2루(위) → 3루(좌) → 홈 */
const HOME: Pos = { x: 50, y: 88 };
const BASE_POS: Pos[] = [
  { x: 74, y: 61 }, // 0 = 1루
  { x: 50, y: 34 }, // 1 = 2루
  { x: 26, y: 61 }, // 2 = 3루
  HOME, // 3 = 홈(득점)
];
const BASE_NAME = ["1루", "2루", "3루", "홈"];
/** -1 = 타석(홈) */
const basePos = (i: number): Pos => (i < 0 ? HOME : BASE_POS[Math.min(3, i)]!);

const LEG_MS = 480; // 베이스 한 칸 주루 시간
const THROW_MS = 620; // 송구 비행 시간

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function PlayerSvg({ color, accent, run }: { color: string; accent: string; run: boolean }) {
  return (
    <svg width="22" height="34" viewBox="0 0 22 34" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.55))" }}>
      <ellipse cx="11" cy="33" rx="6" ry="1.6" fill="rgba(0,0,0,0.35)" />
      <circle cx="11" cy="5.5" r="4" fill="#e8b98a" />
      <path d="M7 4 A4 4 0 0 1 15 4 L15 5 L7 5 Z" fill={accent} />
      <rect x="6.5" y="9.5" width="9" height="11" rx="3" fill={color} />
      <rect x="7.5" y="20" width="7" height="9" rx="2" fill="#f8fafc" />
      <rect x="8" y="27" width="2.4" height="6" rx="1.2" fill="#1e293b"
        style={run ? { transform: "rotate(-18deg)", transformOrigin: "9px 27px" } : undefined} />
      <rect x="11.6" y="27" width="2.4" height="6" rx="1.2" fill="#1e293b"
        style={run ? { transform: "rotate(16deg)", transformOrigin: "12px 27px" } : undefined} />
      <circle cx={run ? 4 : 3.5} cy={run ? 12 : 14} r="2.8" fill="#78350f" stroke="#451a03" strokeWidth="0.6" />
      <rect x="15" y="11" width="2.2" height="7" rx="1.1" fill="#e8b98a" />
    </svg>
  );
}

function RunnerDot({ color, accent, out }: { color: string; accent: string; out?: boolean }) {
  return (
    <svg width="18" height="28" viewBox="0 0 22 34" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))", opacity: out ? 0.5 : 1 }}>
      <circle cx="11" cy="5.5" r="4" fill="#e8b98a" />
      <path d="M7 4 A4 4 0 0 1 15 4 L15 5 L7 5 Z" fill={accent} />
      <rect x="6.5" y="9.5" width="9" height="11" rx="3" fill={color} />
      <rect x="7.5" y="20" width="7" height="9" rx="2" fill="#fde68a" />
      <rect x="8" y="27" width="2.4" height="6" rx="1.2" fill="#1e293b" style={{ transform: "rotate(-20deg)", transformOrigin: "9px 27px" }} />
      <rect x="11.6" y="27" width="2.4" height="6" rx="1.2" fill="#1e293b" style={{ transform: "rotate(18deg)", transformOrigin: "12px 27px" }} />
    </svg>
  );
}

type Leg = { t0: number; t1: number; from: number; to: number };
type RunnerPlan = { legs: Leg[]; start: number; out: boolean };
type ThrowPlan = { at: number; cover: string; label: string; safe: boolean; startT: number; arriveT: number };

/**
 * 타구 궤적 + 9인 수비 개별 움직임 + 주자 진루 연출.
 * 아웃/세이프 판정은 실제 경기 결과(outcome)와 일치하며,
 * 주자 도착 시점과 송구 도착 시점도 그 판정과 어긋나지 않게 계산된다.
 */
export function FieldPlay({
  kind, outcome = "out", color, accent, onDone, bases = [false, false, false], outs = 0,
  runnerColor, runnerAccent, names,
}: {
  names?: Partial<Record<string, string>>;
  kind: BattedKind;
  outcome?: BattedOutcome;
  color: string;
  accent: string;
  onDone?: () => void;
  bases?: [boolean, boolean, boolean];
  outs?: number;
  runnerColor?: string;
  runnerAccent?: string;
}) {
  const rColor = runnerColor ?? "#f59e0b";
  const rAccent = runnerAccent ?? "#b45309";
  const doneRef = useRef(false);
  const [t, setT] = useState(0);

  const plan = useMemo(() => {
    const homer = outcome === "homer" || kind === "homer";
    const dir = Math.random();
    const laneX = dir < 0.34 ? 24 : dir < 0.67 ? 50 : 76;
    const pool =
      kind === "ground"
        ? POSITIONS.filter((p) => p.infield && p.key !== "C" && p.key !== "P")
        : POSITIONS.filter((p) => !p.infield);
    const sorted = [...pool].sort((a, b) => Math.abs(a.pos.x - laneX) - Math.abs(b.pos.x - laneX));
    const fielder = sorted[0]!;
    const landing: Pos = homer
      ? { x: laneX, y: -16 }
      : kind === "ground"
      ? { x: fielder.pos.x, y: fielder.pos.y + 4 }
      : kind === "line"
      ? { x: fielder.pos.x, y: fielder.pos.y + 8 }
      : { x: fielder.pos.x, y: fielder.pos.y - 2 };

    const flightMs = homer ? 1350 : kind === "line" ? 720 : kind === "ground" ? 900 : 1100;
    const catchAt = flightMs + 80;

    // 진루 칸수 (실제 결과와 동일)
    const adv = outcome === "homer" ? 4 : outcome === "triple" ? 3 : outcome === "double" ? 2 : outcome === "single" ? 1 : 0;
    const isHit = adv > 0;

    // 송구 계획: 결과와 일치하는 단 하나의 판정
    let throwPlan: ThrowPlan | null = null;
    // 아웃 판정의 대상 주자 (타자주자 = -1)
    let outRunnerStart = -1;
    let outBase = 0;

    if (!homer) {
      if (!isHit && kind === "ground") {
        // 땅볼 아웃 — 포스 상황이면 선행 주자를 잡을 수도 있다
        const forceThird = bases[0] && bases[1] && outs < 2 && Math.random() < 0.25;
        const forceSecond = bases[0] && outs < 2 && Math.random() < 0.35;
        if (forceThird) { outRunnerStart = 1; outBase = 2; }
        else if (forceSecond) { outRunnerStart = 0; outBase = 1; }
        else { outRunnerStart = -1; outBase = 0; }
        throwPlan = {
          at: outBase,
          cover: outBase === 0 ? "1B" : outBase === 1 ? "2B" : outBase === 2 ? "3B" : "C",
          label: `${fielder.label} → ${BASE_NAME[outBase]} 아웃`,
          safe: false,
          startT: catchAt + 300,
          arriveT: catchAt + 300 + THROW_MS + 160,
        };
      } else if (!isHit) {
        // 플라이/직선타 포구 아웃 — 송구 없음, 포구 순간 아웃
        throwPlan = null;
      } else if (adv < 4) {
        // 안타 — 선행 주자를 노린 송구지만 전원 세이프
        const leadDest = Math.max(
          adv - 1,
          ...bases.map((on, i) => (on ? Math.min(3, i + adv) : -1)),
        );
        const target = Math.min(2, Math.max(0, leadDest));
        throwPlan = {
          at: target,
          cover: target === 0 ? "1B" : target === 1 ? "2B" : "3B",
          label: `${fielder.label} → ${BASE_NAME[target]} 송구, 세이프`,
          safe: true,
          startT: catchAt + 130,
          arriveT: catchAt + 130 + THROW_MS,
        };
      }
    }

    // 주자 계획
    const runners: RunnerPlan[] = [];
    const mkLegs = (start: number, to: number, arriveBy: number): Leg[] => {
      const legs: Leg[] = [];
      const count = to - start;
      if (count <= 0) return legs;
      // 도착 시점을 정확히 맞추기 위해 구간을 균등 분배한다
      const per = Math.max(240, arriveBy / count);
      for (let i = 0; i < count; i++) {
        legs.push({ t0: i * per, t1: (i + 1) * per, from: start + i, to: start + i + 1 });
      }
      return legs;
    };

    const throwArrive = throwPlan ? throwPlan.arriveT : catchAt;
    // 세이프면 송구 도착보다 먼저, 아웃이면 송구 도착보다 늦게 베이스 도착
    const safeArrive = Math.max(500, throwArrive - 240);
    const outArrive = throwArrive + 300;

    if (homer) {
      runners.push({ legs: mkLegs(-1, 3, 4 * LEG_MS), start: -1, out: false });
      bases.forEach((on, i) => { if (on) runners.push({ legs: mkLegs(i, 3, (3 - i) * LEG_MS), start: i, out: false }); });
    } else if (isHit) {
      const batterTo = adv - 1;
      runners.push({
        legs: mkLegs(-1, batterTo, throwPlan && throwPlan.at === batterTo ? safeArrive : (batterTo + 1) * LEG_MS),
        start: -1, out: false,
      });
      bases.forEach((on, i) => {
        if (!on) return;
        const to = Math.min(3, i + adv);
        runners.push({
          legs: mkLegs(i, to, throwPlan && throwPlan.at === to ? safeArrive : (to - i) * LEG_MS),
          start: i, out: false,
        });
      });
    } else {
      // 아웃 — 아웃되는 주자만 해당 베이스로, 나머지는 상황에 맞게
      const batterOut = outRunnerStart === -1;
      runners.push({
        legs: mkLegs(-1, 0, batterOut ? outArrive : safeArrive),
        start: -1,
        out: batterOut && kind === "ground",
      });
      bases.forEach((on, i) => {
        if (!on) return;
        if (!batterOut && i === outRunnerStart) {
          runners.push({ legs: mkLegs(i, outBase, outArrive), start: i, out: true });
        } else if (kind === "ground" && i < outBase) {
          runners.push({ legs: mkLegs(i, i + 1, safeArrive), start: i, out: false });
        } else if (kind === "ground" && batterOut && i === 0) {
          runners.push({ legs: mkLegs(0, 1, safeArrive), start: 0, out: false });
        } else {
          runners.push({ legs: [], start: i, out: false });
        }
      });
    }

    const callAt = throwPlan ? throwPlan.arriveT : catchAt + 120;
    const endAt = homer ? 2600 : callAt + 700;
    const callLabel = homer ? "홈런!" : throwPlan ? (throwPlan.safe ? "세이프!" : "아웃!") : "아웃!";
    const callPos: Pos = homer ? HOME : throwPlan ? basePos(throwPlan.at) : landing;

    return { fielder, landing, flightMs, catchAt, throwPlan, runners, callAt, endAt, callLabel, callPos, homer, isHit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const el = performance.now() - t0;
      setT(el);
      if (el >= plan.endAt) {
        if (!doneRef.current) { doneRef.current = true; onDone?.(); }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 공 위치 ----
  const { landing, catchAt, throwPlan, flightMs } = plan;
  let ball: Pos;
  let lift = 0;
  if (t < flightMs) {
    const p = clamp01(t / flightMs);
    ball = { x: lerp(HOME.x, landing.x, p), y: lerp(HOME.y, landing.y, p) };
    const arc = Math.sin(p * Math.PI);
    lift = (kind === "fly" ? 56 : plan.homer ? 78 : kind === "line" ? 16 : 3) * arc;
  } else if (throwPlan && t >= throwPlan.startT) {
    const p = clamp01((t - throwPlan.startT) / (throwPlan.arriveT - throwPlan.startT));
    const to = basePos(throwPlan.at);
    ball = { x: lerp(landing.x, to.x, p), y: lerp(landing.y, to.y, p) };
    lift = 10 * Math.sin(p * Math.PI);
  } else {
    ball = landing;
  }

  const runnerPos = (r: RunnerPlan): { pos: Pos; running: boolean } => {
    if (!r.legs.length) return { pos: basePos(r.start), running: false };
    const last = r.legs[r.legs.length - 1]!;
    if (t >= last.t1) {
      // 아웃된 주자는 베이스 직전에서 멈춘다
      if (r.out) {
        const a = basePos(last.from), b = basePos(last.to);
        return { pos: { x: lerp(a.x, b.x, 0.88), y: lerp(a.y, b.y, 0.88) }, running: false };
      }
      return { pos: basePos(last.to), running: false };
    }
    const leg = r.legs.find((l) => t >= l.t0 && t < l.t1) ?? r.legs[0]!;
    const p = clamp01((t - leg.t0) / (leg.t1 - leg.t0));
    const a = basePos(leg.from), b = basePos(leg.to);
    return { pos: { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) }, running: true };
  };

  const chaserAt: Pos = (() => {
    if (plan.homer) return plan.fielder.pos;
    const p = clamp01(t / catchAt);
    return { x: lerp(plan.fielder.pos.x, landing.x, p), y: lerp(plan.fielder.pos.y, landing.y, p) };
  })();

  const showCall = t >= plan.callAt;

  return (
    <div className="absolute inset-0 z-[45] pointer-events-none">
      {/* 그라운드(부채꼴) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M50 90 L4 26 A64 64 0 0 1 96 26 Z" fill="rgba(6,78,59,0.82)" stroke="rgba(255,255,255,0.18)" />
        <path d="M50 88 L74 61 L50 34 L26 61 Z" fill="rgba(146,64,14,0.55)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
        <circle cx="50" cy="58" r="6" fill="rgba(146,64,14,0.7)" />
        {[HOME, ...BASE_POS.slice(0, 3)].map((b, i) => (
          <rect key={i} x={b.x - 1.6} y={b.y - 1.6} width="3.2" height="3.2" fill="white" opacity="0.9" />
        ))}
        {throwPlan && t >= throwPlan.startT && (
          <line
            x1={landing.x} y1={landing.y}
            x2={basePos(throwPlan.at).x} y2={basePos(throwPlan.at).y}
            stroke="rgba(253,224,71,0.7)" strokeWidth="0.5" strokeDasharray="2 1.5"
          />
        )}
      </svg>

      {/* 수비수 9명 */}
      {POSITIONS.map((p) => {
        const isChaser = p.key === plan.fielder.key && !plan.homer;
        const covering = !!throwPlan && p.key === throwPlan.cover && !isChaser;
        let target = p.pos;
        if (isChaser) target = chaserAt;
        else if (covering && throwPlan) {
          const q = clamp01(t / throwPlan.arriveT);
          const b = basePos(throwPlan.at);
          target = { x: lerp(p.pos.x, b.x, q), y: lerp(p.pos.y, b.y, q) };
        }
        return (
          <div
            key={p.key}
            className="absolute"
            style={{ left: `${target.x}%`, top: `${target.y}%`, transform: "translate(-50%, -85%)" }}
          >
            <PlayerSvg color={color} accent={accent} run={(isChaser || covering) && t > 60} />
            <div className="text-[7px] text-center text-white/80 font-bold leading-none whitespace-nowrap">{names?.[p.key] ?? p.label}</div>
          </div>
        );
      })}

      {/* 주자 */}
      {plan.runners.map((r, i) => {
        const { pos, running } = runnerPos(r);
        const isOut = r.out && showCall;
        return (
          <div
            key={`r${i}`}
            className="absolute"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -85%)" }}
          >
            <RunnerDot color={rColor} accent={rAccent} out={isOut} />
            {running && <div className="text-[7px] text-center text-yellow-200 font-bold leading-none">주루</div>}
          </div>
        );
      })}

      {/* 타구 그림자 */}
      <div
        className="absolute rounded-[50%] bg-black/45"
        style={{ left: `${ball.x}%`, top: `${ball.y}%`, width: "10px", height: "4px", transform: "translate(-50%, -50%)" }}
      />
      {/* 타구 */}
      <div
        className="absolute w-3 h-3 rounded-full"
        style={{
          left: `${ball.x}%`,
          top: `calc(${ball.y}% - ${lift}px)`,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at 32% 28%, #fff, #e2e8f0 55%, #94a3b8 100%)",
          boxShadow: "0 0 10px rgba(255,255,255,0.7)",
        }}
      />

      {/* 판정 */}
      {showCall && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 text-lg font-black px-2 py-0.5 rounded border-2"
          style={{
            left: `${plan.callPos.x}%`,
            top: `${plan.callPos.y - 9}%`,
            color: plan.callLabel === "아웃!" ? "#f87171" : "#4ade80",
            borderColor: plan.callLabel === "아웃!" ? "#f87171" : "#4ade80",
            background: "rgba(0,0,0,0.72)",
          }}
        >
          {plan.callLabel}
        </div>
      )}

      {!plan.homer && t >= catchAt && (
        <div className="absolute left-1/2 bottom-1 -translate-x-1/2 text-[11px] font-bold px-2 py-0.5 rounded bg-black/70 text-white border border-white/20">
          {throwPlan ? throwPlan.label : `${names?.[plan.fielder.key] ?? plan.fielder.label} 포구 아웃`}
        </div>
      )}
    </div>
  );
}
