import { useEffect, useMemo, useRef, useState } from "react";

export type BattedKind = "fly" | "ground" | "line" | "homer";

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

/** 다이아몬드: 홈(아래) → 1루(우) → 2루(위) → 3루(좌) */
const BASES = {
  home: { x: 50, y: 88 },
  first: { x: 74, y: 61 },
  second: { x: 50, y: 34 },
  third: { x: 26, y: 61 },
} as const;
type BaseKey = keyof typeof BASES;
/** 주루 순서 (index 0=1루, 1=2루, 2=3루, 3=홈) */
const BASE_ORDER: BaseKey[] = ["first", "second", "third", "home"];

const LEG_MS = 430; // 베이스 한 칸 주루 시간
const THROW_MS = 560; // 송구가 베이스에 도착하는 시간 (아웃/세이프 판별용)

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

function RunnerDot({ color, accent }: { color: string; accent: string }) {
  return (
    <svg width="18" height="28" viewBox="0 0 22 34" style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))" }}>
      <circle cx="11" cy="5.5" r="4" fill="#e8b98a" />
      <path d="M7 4 A4 4 0 0 1 15 4 L15 5 L7 5 Z" fill={accent} />
      <rect x="6.5" y="9.5" width="9" height="11" rx="3" fill={color} />
      <rect x="7.5" y="20" width="7" height="9" rx="2" fill="#fde68a" />
      <rect x="8" y="27" width="2.4" height="6" rx="1.2" fill="#1e293b" style={{ transform: "rotate(-20deg)", transformOrigin: "9px 27px" }} />
      <rect x="11.6" y="27" width="2.4" height="6" rx="1.2" fill="#1e293b" style={{ transform: "rotate(18deg)", transformOrigin: "12px 27px" }} />
    </svg>
  );
}

type Route = { to: BaseKey; cover: string; label: string; safe: boolean };

/**
 * 타구 궤적 + 9인 수비 개별 움직임 + 주자 진루 연출.
 * 송구는 베이스까지 THROW_MS 동안 날아가고, 도착 시점에 아웃/세이프 판정이 표시된다.
 */
export function FieldPlay({
  kind, color, accent, onDone, bases = [false, false, false], outs = 0,
  runnerColor, runnerAccent,
}: {
  kind: BattedKind;
  color: string;
  accent: string;
  onDone?: () => void;
  bases?: [boolean, boolean, boolean];
  outs?: number;
  runnerColor?: string;
  runnerAccent?: string;
}) {
  const [phase, setPhase] = useState(0); // 0 타구, 1 포구, 2 송구, 3 후속 송구, 4 판정 종료
  const [legTick, setLegTick] = useState(0); // 주자가 지난 베이스 수
  const [callShown, setCallShown] = useState(false);
  const rColor = runnerColor ?? "#f59e0b";
  const rAccent = runnerAccent ?? "#b45309";
  const doneRef = useRef(false);

  const plan = useMemo(() => {
    const dir = Math.random();
    const laneX = dir < 0.34 ? 24 : dir < 0.67 ? 50 : 76;
    const pool =
      kind === "ground"
        ? POSITIONS.filter((p) => p.infield && p.key !== "C" && p.key !== "P")
        : POSITIONS.filter((p) => !p.infield);
    const sorted = [...pool].sort((a, b) => Math.abs(a.pos.x - laneX) - Math.abs(b.pos.x - laneX));
    const fielder = sorted[0]!;
    const landing: Pos =
      kind === "homer"
        ? { x: laneX, y: -14 }
        : kind === "ground"
        ? { x: fielder.pos.x, y: fielder.pos.y + 4 }
        : kind === "line"
        ? { x: fielder.pos.x, y: fielder.pos.y + 8 }
        : { x: fielder.pos.x, y: fielder.pos.y - 2 };

    const routes: Route[] = [];
    const r = Math.random();
    const safe = () => Math.random() < 0.3;
    if (kind === "ground") {
      if (bases[0] && bases[1] && outs < 2 && r < 0.32) {
        routes.push({ to: "third", cover: "3B", label: `${fielder.label} → 3루 포스`, safe: safe() });
        routes.push({ to: "first", cover: "1B", label: "3루 → 1루 병살", safe: safe() });
      } else if (bases[0] && outs < 2 && r < 0.58) {
        routes.push({ to: "second", cover: "2B", label: `${fielder.label} → 2루 포스`, safe: safe() });
        routes.push({ to: "first", cover: "1B", label: "2루 → 1루 병살!", safe: safe() });
      } else if (bases[0] && r < 0.74) {
        routes.push({ to: "second", cover: "SS", label: `${fielder.label} → 2루 포스`, safe: safe() });
      } else if (bases[2] && r < 0.85) {
        routes.push({ to: "home", cover: "C", label: `${fielder.label} → 홈 승부`, safe: safe() });
      } else {
        routes.push({ to: "first", cover: "1B", label: `${fielder.label} → 1루 송구`, safe: safe() });
      }
    } else if (kind === "fly" || kind === "line") {
      if (bases[2] && r < 0.4) routes.push({ to: "home", cover: "C", label: `${fielder.label} 포구 → 홈 송구`, safe: safe() });
      else if (bases[1] && r < 0.6) routes.push({ to: "third", cover: "3B", label: `${fielder.label} 포구 → 3루 송구`, safe: safe() });
      else if (bases[0] && r < 0.75) routes.push({ to: "second", cover: "2B", label: `${fielder.label} 포구 → 2루 송구`, safe: safe() });
    }
    return { fielder, landing, laneX, routes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const homer = kind === "homer";
  const flightMs = kind === "line" ? 700 : kind === "ground" ? 1000 : 1150;
  const hasSecondThrow = plan.routes.length > 1;

  useEffect(() => {
    const t0 = 40;
    const catchAt = homer ? 1500 : flightMs + 80; // 포구 / 포구 후 송구 시작
    const throw1End = catchAt + THROW_MS;
    const throw2End = throw1End + THROW_MS;
    const endAt = homer ? 2400 : (hasSecondThrow ? throw2End : throw1End) + 420;

    const timers = [
      setTimeout(() => setPhase(1), t0),
      setTimeout(() => setPhase(2), catchAt),
      setTimeout(() => setCallShown(true), throw1End),
      ...(hasSecondThrow
        ? [
            setTimeout(() => { setPhase(3); setCallShown(false); }, throw1End + 120),
            setTimeout(() => setCallShown(true), throw2End),
          ]
        : []),
      setTimeout(() => { if (!doneRef.current) { doneRef.current = true; onDone?.(); } }, endAt),
    ];
    // 주루: 베이스 한 칸씩
    const iv = setInterval(() => setLegTick((v) => v + 1), LEG_MS);
    return () => { timers.forEach(clearTimeout); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ballPos: Pos = phase === 0 ? BASES.home : plan.landing;
  const route0 = plan.routes[0];
  const route1 = plan.routes[1];
  const activeRoute = phase >= 3 && route1 ? route1 : phase >= 2 && route0 ? route0 : null;
  const finalBall = activeRoute ? BASES[activeRoute.to] : ballPos;
  const ballMs = activeRoute ? THROW_MS : flightMs;

  const lift = phase === 0 ? 0 : activeRoute ? 8 : kind === "fly" ? 54 : homer ? 70 : kind === "line" ? 16 : 2;

  /**
   * 주자 진루: 타자주자는 홈(-1)에서 출발.
   * 홈런이면 전원 홈까지, 아니면 타구 종류에 따라 진루 한계를 둔다.
   */
  const advance = homer ? 4 : kind === "line" ? 2 : kind === "fly" ? 1 : 1;
  const runners: { from: number; to: number }[] = [];
  runners.push({ from: -1, to: homer ? 3 : Math.min(3, advance - 1) });
  bases.forEach((on, i) => {
    if (on) runners.push({ from: i, to: Math.min(3, i + advance) });
  });

  const runnerPos = (from: number, to: number): Pos => {
    const start = from; // -1 = 홈
    const reached = Math.min(to, start + legTick);
    if (reached < 0) return BASES.home;
    return BASES[BASE_ORDER[reached]!];
  };

  return (
    <div className="absolute inset-0 z-[45] pointer-events-none">
      {/* 그라운드(부채꼴) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M50 90 L4 26 A64 64 0 0 1 96 26 Z" fill="rgba(6,78,59,0.82)" stroke="rgba(255,255,255,0.18)" />
        <path d="M50 88 L74 61 L50 34 L26 61 Z" fill="rgba(146,64,14,0.55)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
        <circle cx="50" cy="58" r="6" fill="rgba(146,64,14,0.7)" />
        {Object.values(BASES).map((b, i) => (
          <rect key={i} x={b.x - 1.6} y={b.y - 1.6} width="3.2" height="3.2" fill="white" opacity="0.9" />
        ))}
        {activeRoute && (
          <line
            x1={plan.landing.x} y1={plan.landing.y}
            x2={BASES[activeRoute.to].x} y2={BASES[activeRoute.to].y}
            stroke="rgba(253,224,71,0.7)" strokeWidth="0.5" strokeDasharray="2 1.5"
          />
        )}
      </svg>

      {/* 수비수 9명 */}
      {POSITIONS.map((p) => {
        const isChaser = p.key === plan.fielder.key && !homer;
        const covering = activeRoute && p.key === activeRoute.cover && !isChaser;
        const target = covering
          ? BASES[activeRoute!.to]
          : isChaser && phase >= 1
          ? plan.landing
          : p.pos;
        return (
          <div
            key={p.key}
            className="absolute"
            style={{
              left: `${target.x}%`,
              top: `${target.y}%`,
              transform: "translate(-50%, -85%)",
              transition: `left ${flightMs}ms ease-out, top ${flightMs}ms ease-out`,
            }}
          >
            <PlayerSvg color={color} accent={accent} run={(isChaser || !!covering) && phase >= 1} />
            <div className="text-[7px] text-center text-white/80 font-bold leading-none">{p.label}</div>
          </div>
        );
      })}

      {/* 주자 진루 */}
      {runners.map((r, i) => {
        const pos = runnerPos(r.from, r.to);
        return (
          <div
            key={`r${i}`}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -85%)",
              transition: `left ${LEG_MS}ms linear, top ${LEG_MS}ms linear`,
            }}
          >
            <RunnerDot color={rColor} accent={rAccent} />
          </div>
        );
      })}

      {/* 타구 그림자 */}
      <div
        className="absolute rounded-[50%] bg-black/45"
        style={{
          left: `${finalBall.x}%`, top: `${finalBall.y}%`,
          width: "10px", height: "4px",
          transform: "translate(-50%, -50%)",
          transition: `left ${ballMs}ms linear, top ${ballMs}ms linear`,
        }}
      />
      {/* 타구 */}
      <div
        className="absolute w-3 h-3 rounded-full"
        style={{
          left: `${finalBall.x}%`,
          top: `calc(${finalBall.y}% - ${lift}px)`,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle at 32% 28%, #fff, #e2e8f0 55%, #94a3b8 100%)",
          boxShadow: "0 0 10px rgba(255,255,255,0.7)",
          transition: `left ${ballMs}ms ${activeRoute ? "linear" : kind === "ground" ? "linear" : "ease-out"}, top ${ballMs}ms ${
            activeRoute ? "linear" : kind === "fly" || homer ? "cubic-bezier(0.2,-0.4,0.6,1)" : "linear"
          }`,
        }}
      />

      {/* 아웃/세이프 판정 */}
      {activeRoute && callShown && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 text-lg font-black px-2 py-0.5 rounded border-2"
          style={{
            left: `${BASES[activeRoute.to].x}%`,
            top: `${BASES[activeRoute.to].y - 9}%`,
            color: activeRoute.safe ? "#4ade80" : "#f87171",
            borderColor: activeRoute.safe ? "#4ade80" : "#f87171",
            background: "rgba(0,0,0,0.72)",
          }}
        >
          {activeRoute.safe ? "세이프!" : "아웃!"}
        </div>
      )}

      {!homer && phase >= 2 && (
        <div className="absolute left-1/2 bottom-1 -translate-x-1/2 text-[11px] font-bold px-2 py-0.5 rounded bg-black/70 text-white border border-white/20">
          {activeRoute ? activeRoute.label : `${plan.fielder.label} 포구`}
        </div>
      )}
    </div>
  );
}
