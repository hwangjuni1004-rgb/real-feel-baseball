import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { TEAMS, POS_LABEL, type Team, type Batter, type Pitcher, type PitchType } from "@/lib/kbo-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KBO 홈런더비 - 실시간 야구 게임" },
      { name: "description", content: "KBO 실제 팀·선수 기반의 투타 대결 야구 게임. 구종과 코스, 타이밍을 골라 승부하세요." },
    ],
  }),
  component: Game,
});

// ---------- Types ----------
type Phase = "team-select" | "playing" | "result";
type HalfInning = "top" | "bottom";
type PitchLoc = { col: 0 | 1 | 2 | 3 | 4; row: 0 | 1 | 2 | 3 | 4 }; // 5x5, center 3x3 = strike zone
type PitchInFlight = {
  type: PitchType;
  target: PitchLoc; // 투수 겨냥 위치
  actual: PitchLoc; // 실제 도달 위치 (제구 오차 + break)
  speed: number;
  startedAt: number;
  duration: number; // ms
};

// ---------- Helpers ----------
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const inStrikeZone = (loc: PitchLoc) => loc.col >= 1 && loc.col <= 3 && loc.row >= 1 && loc.row <= 3;

// 알려진 발빠른/느린 선수 스피드 오버라이드
const SPEED_MAP: Record<string, number> = {
  "박해민": 10, "김지찬": 10, "정수빈": 9, "김혜성": 10, "황성빈": 10,
  "최지훈": 9, "박찬호": 9, "홍창기": 8, "신민재": 8, "김선빈": 7,
  "박민우": 8, "손아섭": 6, "고승민": 8, "윤동희": 8, "이주형": 8,
  "김주원": 8, "정준재": 8, "김상수": 7, "최인호": 8, "이도윤": 7,
  // 느린 편
  "박병호": 3, "최형우": 3, "강민호": 3, "양의지": 3, "양석환": 4,
  "김재환": 4, "오스틴": 5, "박동원": 4, "채은성": 4, "김태군": 3,
  "유강남": 3, "장성우": 4, "제러드": 5, "디아즈": 5, "최정": 4,
  "이지영": 4, "최재훈": 4, "최주환": 5, "김건희": 5, "이형종": 5,
  "박승욱": 6, "김재호": 5, "김헌곤": 5,
};
const speedOf = (b: Batter): number => SPEED_MAP[b.name] ?? b.speed ?? (5 + Math.round((b.contact - 6) * 0.5));

// ---------- Component ----------
function Game() {
  const [phase, setPhase] = useState<Phase>("team-select");
  const [userTeam, setUserTeam] = useState<Team | null>(null);
  const [cpuTeam, setCpuTeam] = useState<Team | null>(null);
  const [innings, setInnings] = useState<number>(3);

  if (phase === "team-select") {
    return (
      <TeamSelect
        onStart={(u, c, inn) => {
          setUserTeam(u);
          setCpuTeam(c);
          setInnings(inn);
          setPhase("playing");
        }}
      />
    );
  }

  if (phase === "playing" && userTeam && cpuTeam) {
    return (
      <Match
        userTeam={userTeam}
        cpuTeam={cpuTeam}
        innings={innings}
        onFinish={() => setPhase("team-select")}
      />
    );
  }
  return null;
}

// ---------- Team Select ----------
function TeamSelect({ onStart }: { onStart: (u: Team, c: Team, innings: number) => void }) {
  const [user, setUser] = useState<Team | null>(null);
  const [innings, setInnings] = useState<number>(3);
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-stone-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs tracking-widest mb-3">KBO 2025</div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">홈런 더비 나인</h1>
          <p className="mt-2 text-white/70">팀을 선택하세요. 상대는 랜덤으로 매칭됩니다.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              onClick={() => setUser(t)}
              className={`rounded-xl p-4 text-left transition-all border-2 ${
                user?.id === t.id ? "scale-[1.02] shadow-2xl" : "border-transparent hover:scale-[1.01]"
              }`}
              style={{
                backgroundColor: t.color,
                borderColor: user?.id === t.id ? t.accent : "transparent",
              }}
            >
              <div className="text-xs font-mono opacity-80">{t.short}</div>
              <div className="text-lg font-bold mt-1">{t.name}</div>
              <div className="text-xs opacity-80 mt-2">투수 {t.rotation.length}명 · 타자 {t.lineup.length}명</div>
            </button>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 mr-2">경기 이닝</span>
            {[3, 6, 9].map((n) => (
              <button
                key={n}
                onClick={() => setInnings(n)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                  innings === n
                    ? "bg-yellow-400 text-black border-yellow-300"
                    : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                }`}
              >
                {n}이닝
              </button>
            ))}
          </div>
          <button
            disabled={!user}
            onClick={() => {
              if (!user) return;
              const others = TEAMS.filter((t) => t.id !== user.id);
              const cpu = others[Math.floor(Math.random() * others.length)];
              onStart(user, cpu, innings);
            }}
            className="px-8 py-3 rounded-lg bg-yellow-400 text-black font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition"
          >
            경기 시작 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Match ----------
interface GameState {
  inning: number;
  half: HalfInning;
  outs: number;
  balls: number;
  strikes: number;
  scoreUser: number;
  scoreCpu: number;
  userBatIdx: number;
  cpuBatIdx: number;
  userPitIdx: number;
  cpuPitIdx: number;
  bases: [boolean, boolean, boolean]; // 1, 2, 3
  userPitchersOut: number[];
  cpuPitchersOut: number[];
  log: string[];
}

const INNINGS = 3;

function Match({ userTeam, cpuTeam, onFinish }: { userTeam: Team; cpuTeam: Team; onFinish: () => void }) {
  const [state, setState] = useState<GameState>({
    inning: 1,
    half: "top",
    outs: 0,
    balls: 0,
    strikes: 0,
    scoreUser: 0,
    scoreCpu: 0,
    userBatIdx: 0,
    cpuBatIdx: 0,
    userPitIdx: 0,
    cpuPitIdx: 0,
    bases: [false, false, false],
    userPitchersOut: [],
    cpuPitchersOut: [],
    log: [`▶ ${userTeam.name} vs ${cpuTeam.name} 경기 시작!`],
  });

  // user is home team (bat bottom). half=top => cpu bats, user pitches. half=bottom => user bats, cpu pitches.
  const userBats = state.half === "bottom";
  const battingTeam = userBats ? userTeam : cpuTeam;
  const pitchingTeam = userBats ? cpuTeam : userTeam;
  const batter = battingTeam.lineup[(userBats ? state.userBatIdx : state.cpuBatIdx) % battingTeam.lineup.length];
  const pitcher = pitchingTeam.rotation[(userBats ? state.cpuPitIdx : state.userPitIdx) % pitchingTeam.rotation.length];

  const gameOver = state.inning > INNINGS && state.half === "top";

  const appendLog = (msg: string) => {
    setState((s) => ({ ...s, log: [msg, ...s.log].slice(0, 30) }));
  };

  const changeUserPitcher = (newIdx: number) => {
    setState((s) => {
      if (newIdx === s.userPitIdx) return s;
      const newPitcher = userTeam.rotation[newIdx];
      return {
        ...s,
        userPitIdx: newIdx,
        userPitchersOut: [...s.userPitchersOut, s.userPitIdx],
        log: [`🔄 투수 교체: ${newPitcher?.name} 마운드 등판`, ...s.log].slice(0, 30),
      };
    });
  };

  const attemptSteal = (successRate = 0.6) => {
    setState((s) => {
      const bases = [...s.bases] as [boolean, boolean, boolean];
      let fromIdx = -1, toIdx = -1;
      if (bases[0] && !bases[1]) { fromIdx = 0; toIdx = 1; }
      else if (bases[1] && !bases[2]) { fromIdx = 1; toIdx = 2; }
      else return s;
      const success = Math.random() < successRate;
      let outs = s.outs;
      let inning = s.inning, half = s.half, log = s.log;
      let newBases = bases;
      if (success) {
        newBases[fromIdx] = false;
        newBases[toIdx] = true;
        log = [`🏃‍♂️ 도루 성공! ${toIdx + 1}루 진루`, ...log];
      } else {
        newBases[fromIdx] = false;
        outs++;
        log = [`🚨 도루 실패! 태그아웃 (${outs}아웃)`, ...log];
      }
      let balls = s.balls, strikes = s.strikes;
      if (outs >= 3) {
        outs = 0; balls = 0; strikes = 0;
        newBases = [false, false, false];
        if (half === "top") half = "bottom";
        else { half = "top"; inning++; }
        log = [`━━ ${inning}회 ${half === "top" ? "초" : "말"} ━━`, ...log];
      }
      return { ...s, bases: newBases, outs, balls, strikes, inning, half, log };
    });
  };

  // 견제 - auto=true면 무조건 아웃 (상대 도루 시도 중), 아니면 낮은 확률
  const attemptPickoff = (auto: boolean): { out: boolean } => {
    let result = { out: false };
    setState((s) => {
      const bases = [...s.bases] as [boolean, boolean, boolean];
      let targetIdx = -1;
      if (bases[0]) targetIdx = 0;
      else if (bases[1]) targetIdx = 1;
      else if (bases[2]) targetIdx = 2;
      if (targetIdx === -1) return s;
      const success = auto ? true : Math.random() < 0.08;
      let outs = s.outs;
      let inning = s.inning, half = s.half, log = s.log;
      let newBases = bases;
      let balls = s.balls, strikes = s.strikes;
      if (success) {
        newBases[targetIdx] = false;
        outs++;
        result.out = true;
        log = [`🎯 견제 아웃! ${targetIdx + 1}루 주자 태그 (${outs}아웃)`, ...log];
      } else {
        log = [`🎯 견제구 - 세이프`, ...log];
      }
      if (outs >= 3) {
        outs = 0; balls = 0; strikes = 0;
        newBases = [false, false, false];
        if (half === "top") half = "bottom";
        else { half = "top"; inning++; }
        log = [`━━ ${inning}회 ${half === "top" ? "초" : "말"} ━━`, ...log];
      }
      return { ...s, bases: newBases, outs, balls, strikes, inning, half, log };
    });
    return result;
  };




  const advanceCount = (result: "ball" | "strike" | "foul") => {
    setState((s) => {
      let { balls, strikes, outs } = s;
      let bases = [...s.bases] as [boolean, boolean, boolean];
      let scoreUser = s.scoreUser;
      let scoreCpu = s.scoreCpu;
      let userBatIdx = s.userBatIdx;
      let cpuBatIdx = s.cpuBatIdx;
      let inning = s.inning;
      let half = s.half;
      let log = s.log;

      if (result === "ball") {
        balls++;
        if (balls >= 4) {
          log = [`🚶 ${batter.name} 볼넷 출루`, ...log];
          const walkResult = pushRunner(bases);
          bases = walkResult.bases;
          if (walkResult.scored) {
            if (userBats) scoreUser++;
            else scoreCpu++;
            log = [`🏃 득점! (${walkResult.scored}점)`, ...log];
          }
          if (userBats) userBatIdx++;
          else cpuBatIdx++;
          balls = 0;
          strikes = 0;
        }
      } else if (result === "strike") {
        strikes++;
        if (strikes >= 3) {
          outs++;
          log = [`❌ ${batter.name} 삼진 아웃 (${outs}아웃)`, ...log];
          if (userBats) userBatIdx++;
          else cpuBatIdx++;
          balls = 0;
          strikes = 0;
        }
      } else if (result === "foul") {
        // 파울팁 삼진: 2스트라이크 상황에서 10% 확률로 파울팁 → 삼진
        if (strikes >= 2 && Math.random() < 0.1) {
          outs++;
          log = [`⚡ ${batter.name} 파울팁 삼진! (${outs}아웃)`, ...log];
          if (userBats) userBatIdx++;
          else cpuBatIdx++;
          balls = 0;
          strikes = 0;
        } else if (strikes < 2) {
          strikes++;
        }
      }

      if (outs >= 3) {
        outs = 0;
        balls = 0;
        strikes = 0;
        bases = [false, false, false];
        if (half === "top") half = "bottom";
        else {
          half = "top";
          inning++;
        }
        log = [`━━ ${inning}회 ${half === "top" ? "초" : "말"} ━━`, ...log];
      }

      return { ...s, balls, strikes, outs, bases, scoreUser, scoreCpu, userBatIdx, cpuBatIdx, inning, half, log };
    });
  };

  const applyHit = (kind: "single" | "double" | "triple" | "homer" | "out" | "fly" | "foul") => {
    if (kind === "foul") {
      advanceCount("foul");
      return;
    }
    setState((s) => {
      let bases = [...s.bases] as [boolean, boolean, boolean];
      let scoreUser = s.scoreUser;
      let scoreCpu = s.scoreCpu;
      let outs = s.outs;
      let userBatIdx = s.userBatIdx;
      let cpuBatIdx = s.cpuBatIdx;
      let inning = s.inning;
      let half = s.half;
      let log = s.log;

      const scoreFn = (n: number) => {
        if (userBats) scoreUser += n;
        else scoreCpu += n;
      };

      if (kind === "fly") {
        // 희생플라이: 3루 주자 있고 2아웃 미만
        if (bases[2] && outs < 2) {
          scoreFn(1);
          bases[2] = false;
          outs++;
          log = [`🕊️ ${batter.name} 희생플라이! (+1점, ${outs}아웃)`, ...log];
        } else {
          outs++;
          log = [`🪁 ${batter.name} 플라이 아웃 (${outs}아웃)`, ...log];
        }
      } else if (kind === "out") {
        // 1루 주자 있고 2아웃 미만이면 30% 병살
        if (bases[0] && outs < 2 && Math.random() < 0.3) {
          outs += 2;
          bases[0] = false;
          log = [`💀 ${batter.name} 병살타! (${Math.min(outs, 3)}아웃)`, ...log];
        } else {
          outs++;
          log = [`⚾ ${batter.name} 땅볼 아웃 (${outs}아웃)`, ...log];
        }
      } else {
        const adv = kind === "single" ? 1 : kind === "double" ? 2 : kind === "triple" ? 3 : 4;
        let runs = 0;
        // 주자 이동
        const oldBases = [...bases];
        bases = [false, false, false];
        for (let i = 2; i >= 0; i--) {
          if (oldBases[i]) {
            const newPos = i + adv;
            if (newPos >= 3) runs++;
            else bases[newPos] = true;
          }
        }
        // 타자 진루
        if (adv >= 4) runs++;
        else bases[adv - 1] = true;
        scoreFn(runs);
        const label = kind === "single" ? "안타" : kind === "double" ? "2루타" : kind === "triple" ? "3루타" : "🎉 홈런!";
        log = [`💥 ${batter.name} ${label}${runs > 0 ? ` (+${runs}점)` : ""}`, ...log];
      }

      if (userBats) userBatIdx++;
      else cpuBatIdx++;

      let balls = 0;
      let strikes = 0;

      if (outs >= 3) {
        outs = 0;
        bases = [false, false, false];
        if (half === "top") half = "bottom";
        else {
          half = "top";
          inning++;
        }
        log = [`━━ ${inning}회 ${half === "top" ? "초" : "말"} ━━`, ...log];
      }

      return { ...s, bases, scoreUser, scoreCpu, outs, balls, strikes, userBatIdx, cpuBatIdx, inning, half, log };
    });
  };

  if (gameOver) {
    return <Result userTeam={userTeam} cpuTeam={cpuTeam} scoreUser={state.scoreUser} scoreCpu={state.scoreCpu} onFinish={onFinish} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-stone-950 text-white">
      {/* Scoreboard */}
      <div className="bg-black/60 backdrop-blur px-4 py-3 border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <TeamBadge team={cpuTeam} score={state.scoreCpu} active={state.half === "top"} />
            <div className="text-white/40 text-sm">VS</div>
            <TeamBadge team={userTeam} score={state.scoreUser} active={state.half === "bottom"} />
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">{state.inning}회 {state.half === "top" ? "초" : "말"}</div>
            <div className="text-sm font-mono">
              {state.outs}아웃 · B{state.balls} S{state.strikes}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_280px] gap-6 p-4 md:p-6">
        <div>
          {userBats ? (
            <BatterView
              batter={batter}
              pitcher={pitcher}
              onCount={advanceCount}
              onHit={applyHit}
              bases={state.bases}
              onSteal={() => attemptSteal(clamp(0.62 + (batter.contact - 6) * 0.04, 0.5, 0.88))}
              battingTeam={userTeam}
              key={`bat-${state.userBatIdx}-${state.balls}-${state.strikes}-${state.outs}-${state.inning}-${state.half}`}
            />
          ) : (
            <PitcherView
              batter={batter}
              pitcher={pitcher}
              onCount={advanceCount}
              onHit={applyHit}
              rotation={userTeam.rotation}
              currentIdx={state.userPitIdx}
              usedIdx={state.userPitchersOut}
              onChangePitcher={changeUserPitcher}
              bases={state.bases}
              onPickoff={attemptPickoff}
              onCpuSteal={() => attemptSteal(0.55)}
              battingTeam={cpuTeam}
              balls={state.balls}
              strikes={state.strikes}
              key={`pit-${state.cpuBatIdx}-${state.balls}-${state.strikes}-${state.outs}-${state.inning}-${state.half}-${state.userPitIdx}`}
            />
          )}
          <Diamond bases={state.bases} />
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="text-xs text-white/60 mb-2">현재 타석</div>
            <div className="font-bold text-lg">{batter.name}</div>
            <div className="text-xs text-white/70">{POS_LABEL[batter.pos]} · {batter.bats === "L" ? "좌타" : batter.bats === "R" ? "우타" : "스위치"}</div>
            <div className="mt-2 flex gap-3 text-xs">
              <span>파워 {batter.power}</span>
              <span>정확 {batter.contact}</span>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
            <div className="text-xs text-white/60 mb-2">투수</div>
            <div className="font-bold text-lg">{pitcher.name}</div>
            <div className="text-xs text-white/70">{pitcher.throws === "L" ? "좌투" : "우투"} · 최고 {pitcher.velo}km/h</div>
            <div className="mt-2 text-xs">제구 {pitcher.control}</div>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-3 max-h-64 overflow-y-auto">
            <div className="text-xs text-white/60 mb-2">경기 로그</div>
            <ul className="text-xs space-y-1">
              {state.log.map((l, i) => (
                <li key={i} className={i === 0 ? "text-yellow-300" : "text-white/70"}>{l}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function pushRunner(bases: [boolean, boolean, boolean]): { bases: [boolean, boolean, boolean]; scored: number } {
  const b: [boolean, boolean, boolean] = [true, bases[0], bases[1]];
  const scored = bases[2] ? 1 : 0;
  return { bases: b, scored };
}

function TeamBadge({ team, score, active }: { team: Team; score: number; active: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${active ? "ring-2 ring-yellow-300" : ""}`} style={{ backgroundColor: team.color }}>
      <span className="font-mono text-xs opacity-80">{team.short}</span>
      <span className="font-bold text-lg tabular-nums">{score}</span>
    </div>
  );
}

// ---------- Pitcher View (user pitches) ----------
const MAX_PICKOFFS = 3;
function PitcherView({
  batter, pitcher, onCount, onHit, rotation, currentIdx, usedIdx, onChangePitcher,
  bases, onPickoff, onCpuSteal, battingTeam, balls, strikes,
}: {
  batter: Batter; pitcher: Pitcher;
  onCount: (r: "ball" | "strike" | "foul") => void;
  onHit: (r: "single" | "double" | "triple" | "homer" | "out" | "fly" | "foul") => void;
  rotation: Pitcher[];
  currentIdx: number;
  usedIdx: number[];
  onChangePitcher: (idx: number) => void;
  bases: [boolean, boolean, boolean];
  onPickoff: (auto: boolean) => { out: boolean };
  onCpuSteal: () => void;
  battingTeam: Team;
  balls: number;
  strikes: number;
}) {
  const [pitchTypeIdx, setPitchTypeIdx] = useState(0);
  const [target, setTarget] = useState<PitchLoc | null>(null);
  const [pitch, setPitch] = useState<PitchInFlight | null>(null);
  const [phaseMsg, setPhaseMsg] = useState<string>("구종과 코스를 선택하세요");
  const [showChange, setShowChange] = useState(false);
  const [pickoffs, setPickoffs] = useState(0);
  const [hitLabel, setHitLabel] = useState<{ text: string; kind: "single" | "double" | "triple" | "homer" } | null>(null);
  const [swingAnim, setSwingAnim] = useState(false);
  const [lastPitch, setLastPitch] = useState<{ name: string; speed: number; result: string } | null>(null);
  // 이번 타석 투구 히스토리 (CPU 타자가 다음 구종 예측에 사용)
  const pitchHistoryRef = useRef<string[]>([]);
  const showHit = (text: string, kind: "single" | "double" | "triple" | "homer", ms: number) => {
    setHitLabel({ text, kind });
    setTimeout(() => setHitLabel(null), ms);
  };
  const triggerSwing = () => {
    setSwingAnim(true);
    setTimeout(() => setSwingAnim(false), 420);
  };
  const cpuStealRef = useRef<boolean>(
    (bases[0] || bases[1]) && Math.random() < 0.25
  );
  const hasRunner = bases[0] || bases[1] || bases[2];

  const doPickoff = () => {
    if (pitch || pickoffs >= MAX_PICKOFFS || !hasRunner) return;
    const auto = cpuStealRef.current;
    const res = onPickoff(auto);
    setPickoffs((n) => n + 1);
    if (res.out) {
      cpuStealRef.current = false;
      setPhaseMsg(auto ? "🎯 상대 도루 저지! 견제 아웃" : "🎯 견제 아웃!");
    } else {
      setPhaseMsg("견제 - 세이프");
    }
  };

  // CPU 타자의 구종 예측 (실제 야구 시퀀싱 데이터 기반)
  // 3-0, 2-0, 3-1: 스트라이크 필요 → 패스트볼 예측
  // 0-2, 1-2: 헛스윙/유인구 → 변화구 예측
  // 이전 공이 변화구였고 카운트 유리 → 다시 변화구
  // 좌투 vs 좌타 : 슬라이더 자주
  const predictNextPitch = (): string => {
    const hasFB = pitcher.pitches.find((p) => p.name === "포심 패스트볼");
    const breaking = pitcher.pitches.filter((p) => p.name === "슬라이더" || p.name === "커브" || p.name === "포크볼");
    const offspeed = pitcher.pitches.filter((p) => p.name === "체인지업" || p.name === "투심");
    const lastType = pitchHistoryRef.current[pitchHistoryRef.current.length - 1];
    // 히터 카운트: 3-0, 3-1, 2-0
    if ((balls === 3 && strikes <= 1) || (balls === 2 && strikes === 0)) {
      return hasFB ? "포심 패스트볼" : pitcher.pitches[0].name;
    }
    // 투수 카운트: 0-2, 1-2
    if (strikes === 2 && balls <= 1) {
      const pool = [...breaking, ...offspeed];
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)].name;
    }
    // 좌투 vs 좌타 매치업: 슬라이더 자주
    if (pitcher.throws === "L" && batter.bats === "L") {
      const sl = pitcher.pitches.find((p) => p.name === "슬라이더");
      if (sl && Math.random() < 0.5) return "슬라이더";
    }
    // 연속 같은 구종 회피 (실제 야구 시퀀싱)
    if (lastType && Math.random() < 0.55) {
      const others = pitcher.pitches.filter((p) => p.name !== lastType);
      if (others.length) return others[Math.floor(Math.random() * others.length)].name;
    }
    // 기본: 60% 패스트볼
    if (hasFB && Math.random() < 0.6) return "포심 패스트볼";
    return pitcher.pitches[Math.floor(Math.random() * pitcher.pitches.length)].name;
  };

  const throwPitch = () => {
    if (!target) return;
    const type = pitcher.pitches[pitchTypeIdx];
    // 제구 능력에 따른 오차 - 제구 좋으면 목표 근처 + 코너 유지
    const controlFactor = (11 - pitcher.control) / 10; // 1(제구10)→0.1, 1(제구1)→1.0
    const errRange = controlFactor * 1.6;
    const errX = rand(-errRange, errRange);
    const errY = rand(-errRange, errRange);
    // 코너를 겨냥한 경우 제구 좋으면 살짝 코너 쪽으로 더 밀기
    const cornerX = target.col === 1 ? -0.3 : target.col === 3 ? 0.3 : 0;
    const cornerY = target.row === 1 ? -0.3 : target.row === 3 ? 0.3 : 0;
    const controlNudge = (pitcher.control - 5) * 0.12;
    const mirror = pitcher.throws === "L" ? -1 : 1;
    const bx = type.break.x * mirror;
    const by = type.break.y;
    const actual: PitchLoc = {
      col: clamp(Math.round(target.col + errX + bx + cornerX * controlNudge), 0, 4) as PitchLoc["col"],
      row: clamp(Math.round(target.row + errY + by + cornerY * controlNudge), 0, 4) as PitchLoc["row"],
    };
    const speed = Math.round(rand(type.speedMin, type.speedMax));
    // 구속에 따른 시각적 duration - 확실히 차이 나게
    const duration = Math.round(clamp(1500 - (speed - 120) * 22, 620, 1500));
    setPitch({ type, target, actual, speed, startedAt: Date.now(), duration });
    setPhaseMsg("공이 날아갑니다...");
    const predicted = predictNextPitch();
    const matched = predicted === type.name;
    pitchHistoryRef.current.push(type.name);

    setTimeout(() => {
      const resultMsg = simulateCpuBatter(
        actual, batter, type, onCount, onHit, setPhaseMsg, showHit, triggerSwing,
        { pitcher, predictedMatch: matched, speed },
      );
      setLastPitch({ name: type.name, speed, result: resultMsg });
      setPitch(null);
      setTarget(null);
      if (cpuStealRef.current) {
        cpuStealRef.current = false;
        setTimeout(() => onCpuSteal(), 400);
      }
    }, duration + 80);
  };


  return (
    <div className="rounded-xl bg-emerald-900/40 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">🥎 투구 - {pitcher.name}</h2>
        <div className="text-xs text-white/60">{phaseMsg}</div>
      </div>
      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <StrikeZone
          target={target}
          pitch={pitch}
          onSelect={(loc) => !pitch && setTarget(loc)}
          pitcher={pitcher}
          batter={batter}
          hitLabel={hitLabel}
          swinging={swingAnim}
          battingTeam={battingTeam}
        />

        <div className="space-y-2">
          {lastPitch && (
            <div className="rounded-lg bg-black/50 border border-white/10 px-2 py-1.5 text-xs">
              <div className="text-white/50 text-[10px]">지난 공</div>
              <div className="font-bold text-yellow-200">{lastPitch.speed}km/h · {lastPitch.name}</div>
              <div className="text-white/70 text-[10px]">→ {lastPitch.result}</div>
            </div>
          )}
          <div className="text-xs text-white/60">구종 선택</div>
          {pitcher.pitches.map((p, i) => (
            <button
              key={i}
              onClick={() => !pitch && setPitchTypeIdx(i)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm border transition ${
                pitchTypeIdx === i
                  ? "bg-yellow-400 text-black border-yellow-300 font-bold"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
            >
              <div>{p.name}</div>
              <div className="text-xs opacity-70">{p.speedMin}-{p.speedMax}km/h</div>
            </button>
          ))}
          <button
            onClick={throwPitch}
            disabled={!target || !!pitch}
            className="w-full mt-2 py-3 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white"
          >
            투구!
          </button>
          <button
            onClick={doPickoff}
            disabled={!!pitch || pickoffs >= MAX_PICKOFFS || !hasRunner}
            className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold border border-orange-300/30 text-white"
          >
            🎯 견제 ({pickoffs}/{MAX_PICKOFFS})
          </button>
          <button
            onClick={() => setShowChange((v) => !v)}
            disabled={!!pitch}
            className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-semibold border border-white/10"
          >
            🔄 투수 교체
          </button>
          {showChange && (
            <div className="rounded-lg bg-black/60 border border-white/10 p-2 space-y-1 max-h-56 overflow-y-auto">
              <div className="text-[10px] text-white/60 px-1 pb-1">불펜 (교체 후 재등판 불가)</div>
              {rotation.map((p, idx) => {
                const isCurrent = idx === currentIdx;
                const isUsed = usedIdx.includes(idx);
                const disabled = isCurrent || isUsed;
                return (
                  <button
                    key={idx}
                    disabled={disabled}
                    onClick={() => {
                      onChangePitcher(idx);
                      setShowChange(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                      isCurrent
                        ? "bg-yellow-400/20 text-yellow-200 cursor-default"
                        : isUsed
                        ? "bg-white/5 text-white/30 line-through cursor-not-allowed"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    <div className="font-bold">{p.name} {isCurrent && "(등판중)"}</div>
                    <div className="opacity-70">{p.throws === "L" ? "좌투" : "우투"} · {p.velo}km/h · 제구 {p.control}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 구종별 컨택 난이도 (직구 쉽고, 변화구일수록 어려움)
const PITCH_CONTACT_MOD: Record<string, number> = {
  "포심 패스트볼": 0.15,
  "투심": 0.05,
  "체인지업": -0.10,
  "슬라이더": -0.18,
  "커브": -0.22,
  "포크볼": -0.28,
};

function simulateCpuBatter(
  actual: PitchLoc,
  batter: Batter,
  pitchType: PitchType,
  onCount: (r: "ball" | "strike" | "foul") => void,
  onHit: (r: "single" | "double" | "triple" | "homer" | "out" | "fly" | "foul") => void,
  setMsg: (s: string) => void,
  showHit?: (text: string, kind: "single" | "double" | "triple" | "homer", ms: number) => void,
  triggerSwing?: () => void,
  opts?: { pitcher: Pitcher; predictedMatch: boolean; speed: number },
): string {
  const pitchTypeName = pitchType.name;
  const strike = inStrikeZone(actual);
  const typeMod = PITCH_CONTACT_MOD[pitchTypeName] ?? 0;
  // 코너까지의 거리 (중심 2,2 기준) - 존 안 코너면 안타 확률 하락
  const cornerDist = Math.max(Math.abs(actual.col - 2), Math.abs(actual.row - 2)); // 0(중앙)~2(밖)
  const cornerPenalty = strike ? (cornerDist === 2 ? -0.15 : cornerDist === 1 ? -0.05 : 0.05) : 0;

  // 플래툰 (좌투 vs 좌타, 우투 vs 우타는 타자 불리)
  const platoon = opts?.pitcher
    ? (opts.pitcher.throws === batter.bats ? -0.06 : batter.bats === "S" ? 0.01 : 0.05)
    : 0;
  // 예측 성공 시 CPU 타자 유리
  const predBonus = opts?.predictedMatch ? 0.14 : -0.08;
  // 구속 - 빠를수록 컨택 하락
  const speedPenalty = opts ? -clamp((opts.speed - 145) * 0.008, -0.05, 0.15) : 0;

  const swingBase = strike ? 0.78 : 0.30;
  const swingProb = clamp(swingBase + (batter.contact - 6) * 0.03 - typeMod * 0.3 + (opts?.predictedMatch ? 0.08 : -0.05), 0.1, 0.95);
  const swings = Math.random() < swingProb;
  if (swings && triggerSwing) triggerSwing();

  if (!swings) {
    if (strike) { setMsg("루킹 스트라이크!"); onCount("strike"); return "루킹 스트라이크"; }
    setMsg("볼"); onCount("ball"); return "볼";
  }
  const contactProb = clamp(
    (strike ? 0.78 : 0.4) + (batter.contact - 6) * 0.04 + typeMod + platoon + predBonus + speedPenalty + cornerPenalty * 0.4,
    0.05, 0.96,
  );
  if (Math.random() > contactProb) {
    setMsg("헛스윙!"); onCount("strike"); return "헛스윙";
  }
  const power = batter.power;
  let qualityRoll = Math.random() + (power - 5) * 0.03 + (strike ? 0.1 : -0.15) + typeMod * 0.5 + predBonus * 0.5 + platoon * 0.5 + cornerPenalty;
  if (qualityRoll < 0.35) { setMsg("파울"); onCount("foul"); return "파울"; }
  if (qualityRoll < 0.58) {
    if (Math.random() < 0.5) { setMsg("플라이 아웃"); onHit("fly"); return "플라이"; }
    setMsg("땅볼 아웃"); onHit("out"); return "땅볼";
  }
  const doHit = (
    text: string,
    kind: "single" | "double" | "triple" | "homer",
    hitKind: "single" | "double" | "triple" | "homer",
    ms: number,
  ) => {
    setMsg(text);
    if (showHit) {
      showHit(text.replace("!", "").replace("🎉", "").trim() || text, kind, ms + 100);
      setTimeout(() => onHit(hitKind), ms);
    } else {
      onHit(hitKind);
    }
  };
  if (qualityRoll < 0.80) { doHit("안타!", "single", "single", 850); return "안타"; }
  if (qualityRoll < 0.92) { doHit("2루타!", "double", "double", 950); return "2루타"; }
  if (qualityRoll < 0.97) { doHit("3루타!", "triple", "triple", 1050); return "3루타"; }
  doHit("🎉 홈런! 🎉", "homer", "homer", 1500);
  return "홈런";
}

// ---------- Batter View (user bats) ----------
function BatterView({
  batter, pitcher, onCount, onHit, bases, onSteal, battingTeam,
}: {
  batter: Batter; pitcher: Pitcher;
  onCount: (r: "ball" | "strike" | "foul") => void;
  onHit: (r: "single" | "double" | "triple" | "homer" | "out" | "fly" | "foul") => void;
  bases: [boolean, boolean, boolean];
  onSteal: () => void;
  battingTeam: Team;
}) {
  const [guessLoc, setGuessLoc] = useState<PitchLoc | null>(null);
  const [pitch, setPitch] = useState<PitchInFlight | null>(null);
  const [phaseMsg, setPhaseMsg] = useState<string>("겨냥할 코스를 고르고 준비하세요");
  const [ready, setReady] = useState(false);
  const swungRef = useRef(false);
  const timingWindow = useRef<{ start: number; end: number; ideal: number } | null>(null);
  const [swingAnim, setSwingAnim] = useState(false);
  const [hitLabel, setHitLabel] = useState<{ text: string; kind: "single" | "double" | "triple" | "homer" } | null>(null);
  const showHit = (text: string, kind: "single" | "double" | "triple" | "homer", delayMs: number) => {
    setHitLabel({ text, kind });
    setTimeout(() => setHitLabel(null), delayMs);
  };

  const startPitch = () => {
    swungRef.current = false;
    const type = pitcher.pitches[Math.floor(Math.random() * pitcher.pitches.length)];
    // 75% strike, 25% 아슬아슬한 볼 (완전 밖 X). 존 근처로만 빠지게
    const wantStrike = Math.random() < 0.75;
    const edgeCol = Math.random() < 0.5 ? 0 : 4;
    const edgeRow = Math.random() < 0.5 ? 0 : 4;
    const targetCol = (wantStrike ? Math.floor(rand(1, 4)) : (Math.random() < 0.7 ? edgeCol : Math.floor(rand(1, 4)))) as PitchLoc["col"];
    const targetRow = (wantStrike ? Math.floor(rand(1, 4)) : (Math.random() < 0.5 ? edgeRow : Math.floor(rand(1, 4)))) as PitchLoc["row"];
    const target: PitchLoc = { col: targetCol, row: targetRow };
    // 제구 좋으면 오차 작고 코너 유지
    const controlFactor = (11 - pitcher.control) / 10;
    const errRange = controlFactor * 1.4;
    const errX = rand(-errRange, errRange);
    const errY = rand(-errRange, errRange);
    const cornerX = target.col === 1 ? -0.3 : target.col === 3 ? 0.3 : 0;
    const cornerY = target.row === 1 ? -0.3 : target.row === 3 ? 0.3 : 0;
    const controlNudge = (pitcher.control - 5) * 0.12;
    const mirror = pitcher.throws === "L" ? -1 : 1;
    const actual: PitchLoc = {
      col: clamp(Math.round(target.col + errX + type.break.x * mirror + cornerX * controlNudge), 0, 4) as PitchLoc["col"],
      row: clamp(Math.round(target.row + errY + type.break.y + cornerY * controlNudge), 0, 4) as PitchLoc["row"],
    };
    const speed = Math.round(rand(type.speedMin, type.speedMax));
    // 구속 시각 격차 크게: 140→1220ms, 160→780ms
    const duration = Math.round(clamp(1500 - (speed - 120) * 22, 620, 1500));
    const startedAt = Date.now();
    setPitch({ type, target, actual, speed, startedAt, duration });
    setReady(true);
    setPhaseMsg("스윙 타이밍을 맞추세요!");
    timingWindow.current = {
      start: startedAt + duration - 220,
      end: startedAt + duration + 120,
      ideal: startedAt + duration - 40,
    };

    setTimeout(() => {
      if (!swungRef.current) {
        const strike = inStrikeZone(actual);
        setPhaseMsg(strike ? "루킹 스트라이크!" : "볼");
        onCount(strike ? "strike" : "ball");
      }
      setPitch(null);
      setReady(false);
    }, duration + 200);
  };

  const swing = () => {
    if (!pitch || swungRef.current) return;
    swungRef.current = true;
    setSwingAnim(true);
    setTimeout(() => setSwingAnim(false), 400);
    const now = Date.now();
    const w = timingWindow.current!;
    // 타이밍 판정
    let timing: "perfect" | "good" | "early" | "late" | "miss";
    const diff = now - w.ideal;
    if (Math.abs(diff) < 60) timing = "perfect";
    else if (Math.abs(diff) < 130) timing = "good";
    else if (now < w.start) timing = "miss";
    else if (diff > 0 && now <= w.end) timing = "late";
    else if (diff < 0) timing = "early";
    else timing = "miss";

    // 존 예측 정확도
    const zoneMatch = guessLoc
      ? Math.max(0, 1 - (Math.abs(guessLoc.col - pitch.actual.col) + Math.abs(guessLoc.row - pitch.actual.row)) / 4)
      : 0.4;

    const strike = inStrikeZone(pitch.actual);
    // 코너 정도 - 존 안이면서 구석일수록 안타 어려움, 한복판이면 쉬움
    const cornerDist = Math.max(Math.abs(pitch.actual.col - 2), Math.abs(pitch.actual.row - 2));
    const cornerAdj = strike ? (cornerDist === 2 ? -0.12 : cornerDist === 1 ? -0.04 : 0.06) : 0;
    // 플래툰: 같은 손 매치업은 타자 불리
    const platoon = pitcher.throws === batter.bats ? -0.06 : batter.bats === "S" ? 0.01 : 0.05;
    // 구속 페널티
    const speedPen = -clamp((pitch.speed - 145) * 0.006, -0.04, 0.12);
    // 정확 스탯: 존 밖 컨택 확률
    const chaseSkill = 0.55 + (batter.contact - 5) * 0.06; // 정확 10 → 0.85, 5 → 0.55

    if (timing === "miss") {
      setPhaseMsg("헛스윙!");
      onCount("strike");
      return;
    }

    // contact 확률
    const contactProb = clamp(
      (timing === "perfect" ? 0.95 : timing === "good" ? 0.78 : 0.42) *
      (0.55 + zoneMatch * 0.45) *
      (strike ? 1 : chaseSkill) +
      platoon + speedPen + cornerAdj * 0.3,
      0.05, 0.98,
    );
    if (Math.random() > contactProb) {
      setPhaseMsg("헛스윙!");
      onCount("strike");
      return;
    }

    // 타구 퀄리티
    let q = Math.random();
    if (timing === "perfect") q += 0.4;
    else if (timing === "good") q += 0.15;
    q += (batter.power - 5) * 0.04;
    q += zoneMatch * 0.15;
    q += cornerAdj;
    q += platoon * 0.5;

    if (q < 0.45) { setPhaseMsg("파울"); onCount("foul"); return; }
    if (q < 0.62) {
      // 아웃 - 땅볼/플라이 50:50 (perfect 타이밍은 플라이 확률 상승)
      const flyBias = timing === "perfect" ? 0.7 : timing === "good" ? 0.55 : 0.5;
      if (Math.random() < flyBias) { setPhaseMsg("플라이 아웃"); onHit("fly"); }
      else { setPhaseMsg("땅볼 아웃"); onHit("out"); }
      return;
    }
    if (q < 0.82) { setPhaseMsg("안타!"); showHit("안타", "single", 900); setTimeout(() => onHit("single"), 850); return; }
    if (q < 0.95) { setPhaseMsg("2루타!"); showHit("2루타", "double", 1000); setTimeout(() => onHit("double"), 950); return; }
    if (q < 1.05) { setPhaseMsg("3루타!"); showHit("3루타", "triple", 1100); setTimeout(() => onHit("triple"), 1050); return; }
    setPhaseMsg("🎉 홈런!"); showHit("🎉 홈런! 🎉", "homer", 1600); setTimeout(() => onHit("homer"), 1500);
  };

  // 스페이스바 지원
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (ready) swing();
        else if (!pitch) startPitch();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pitch]);

  return (
    <div className="rounded-xl bg-emerald-900/40 border border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">🏏 타격 - {batter.name}</h2>
        <div className="text-xs text-white/60">{phaseMsg}</div>
      </div>
      <div className="grid md:grid-cols-[1fr_180px] gap-4">
        <StrikeZone
          target={guessLoc}
          pitch={pitch}
          onSelect={(loc) => !pitch && setGuessLoc(loc)}
          showActual={!!pitch}
          pitcher={pitcher}
          batter={batter}
          swinging={swingAnim}
          hitLabel={hitLabel}
          battingTeam={battingTeam}
        />

        <div className="space-y-2">
          <div className="text-xs text-white/60">좌측에서 겨냥할 코스를 선택. 공이 미트에 닿는 순간 스윙!</div>
          {!ready ? (
            <button
              onClick={startPitch}
              className="w-full py-3 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300"
            >
              투구 요청 (Space)
            </button>
          ) : (
            <button
              onClick={swing}
              className="w-full py-6 rounded-lg bg-red-500 hover:bg-red-400 font-black text-white text-xl animate-pulse"
            >
              스윙! (Space)
            </button>
          )}
          {!ready && !pitch && (bases[0] || bases[1]) && (
            <button
              onClick={onSteal}
              className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold border border-sky-300/30"
            >
              🏃 도루 시도
            </button>
          )}
          {pitch && (
            <div className="rounded-lg bg-black/40 p-2 text-xs">
              <div className="text-white/60">추정 구종</div>
              <div className="font-bold">{pitch.type.name}</div>
              <div className="text-white/70">{pitch.speed}km/h</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Strike Zone ----------
function StrikeZone({
  target, pitch, onSelect, showActual, pitcher, batter, swinging, hitLabel, battingTeam,
}: {
  target: PitchLoc | null;
  pitch: PitchInFlight | null;
  onSelect: (loc: PitchLoc) => void;
  showActual?: boolean;
  pitcher?: Pitcher;
  batter?: Batter;
  swinging?: boolean;
  hitLabel?: { text: string; kind: "single" | "double" | "triple" | "homer" } | null;
  battingTeam?: Team;
}) {
  const [ballPos, setBallPos] = useState<{ x: number; y: number; scale: number } | null>(null);
  const animRef = useRef<number | undefined>(undefined);
  const [windup, setWindup] = useState(false);

  useEffect(() => {
    if (!pitch) { setBallPos(null); setWindup(false); return; }
    setWindup(true);
    const anim = () => {
      const t = clamp((Date.now() - pitch.startedAt) / pitch.duration, 0, 1);
      const startX = 2, startY = 2;
      const endX = pitch.actual.col, endY = pitch.actual.row;
      const midX = (startX + endX) / 2 + pitch.type.break.x * 0.5;
      const midY = (startY + endY) / 2 - pitch.type.break.y * 0.3;
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * endX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * endY;
      const scale = 0.35 + t * 0.9;
      setBallPos({ x, y, scale });
      if (t > 0.15) setWindup(false);
      if (t < 1) animRef.current = requestAnimationFrame(anim);
    };
    animRef.current = requestAnimationFrame(anim);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [pitch]);

  const batterLeft = batter?.bats === "L";

  return (
    <div className="relative aspect-square bg-gradient-to-b from-sky-700 via-emerald-800 to-emerald-950 rounded-lg overflow-hidden border-2 border-white/20">
      {/* 마운드 */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[8%] w-[45%] h-8 bg-amber-900/60 rounded-[50%] blur-[1px]" />
      {/* 투수 (뒷모습, 작게) */}
      {pitcher && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-[6%] transition-transform duration-200"
          style={{ transform: `translateX(-50%) scale(${windup ? 1.1 : 1}) rotate(${windup ? -8 : 0}deg)` }}
        >
          <PitcherSvg throws={pitcher.throws} windup={windup} />
          <div className="text-[9px] text-center text-white font-bold bg-black/50 rounded px-1 mt-0.5 whitespace-nowrap">
            {pitcher.name}
          </div>
        </div>
      )}

      {/* 홈플레이트 */}
      <div className="absolute left-1/2 bottom-3 -translate-x-1/2 w-24 h-6 bg-white/90"
        style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 15% 100%)" }} />

      {/* 5x5 grid */}
      <div className="absolute inset-6 grid grid-cols-5 grid-rows-5 gap-0 z-10">
        {Array.from({ length: 25 }).map((_, i) => {
          const col = (i % 5) as PitchLoc["col"];
          const row = Math.floor(i / 5) as PitchLoc["row"];
          const isStrike = col >= 1 && col <= 3 && row >= 1 && row <= 3;
          const isTarget = target?.col === col && target?.row === row;
          return (
            <button
              key={i}
              onClick={() => onSelect({ col, row })}
              className={`border transition ${
                isStrike ? "border-yellow-300/40" : "border-white/5"
              } ${isTarget ? "bg-yellow-300/50 ring-2 ring-yellow-200" : "hover:bg-white/10"}`}
            />
          );
        })}
      </div>

      {/* 스트라이크 존 외곽 강조 */}
      <div className="absolute pointer-events-none border-2 border-yellow-300/90 rounded-sm z-10"
        style={{
          left: `calc(6px + 20% * 1 + 4px)`,
          top: `calc(6px + 20% * 1 + 4px)`,
          width: `calc(60% - 8px)`,
          height: `calc(60% - 8px)`,
        }}
      />

      {/* 타자 */}
      {batter && (
        <div
          className={`absolute bottom-1 z-20 transition-transform duration-150 ${batterLeft ? "right-2" : "left-2"}`}
          style={{ transform: `${swinging ? "rotate(" + (batterLeft ? "-" : "") + "35deg)" : "rotate(0deg)"}` }}
        >
          <BatterSvg bats={batter.bats} swinging={!!swinging} />
          <div className="text-[9px] text-center text-white font-bold bg-black/50 rounded px-1 mt-0.5 whitespace-nowrap">
            {batter.name}
          </div>
        </div>
      )}

      {/* 날아오는 공 */}
      {ballPos && (
        <div
          className="absolute w-6 h-6 rounded-full bg-white shadow-lg pointer-events-none z-30"
          style={{
            left: `calc(${(ballPos.x / 5) * 100}% + 10%)`,
            top: `calc(${(ballPos.y / 5) * 100}% + 10%)`,
            transform: `translate(-50%, -50%) scale(${ballPos.scale})`,
            boxShadow: "0 0 20px rgba(255,255,255,0.8)",
          }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-red-500/70" style={{ clipPath: "inset(45% 0 45% 0)" }} />
        </div>
      )}

      {pitch && showActual === undefined && (
        <div className="absolute top-1 left-2 text-[10px] text-white/80 z-30 bg-black/40 px-1 rounded">
          {pitch.speed}km/h · {pitch.type.name}
        </div>
      )}

      {/* 공용 키프레임 */}
      <style>{`
        @keyframes zoneBatSwing {
          0% { transform: translate(-50%, -50%) rotate(-80deg) scale(0.8); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(55deg) scale(1.05); opacity: 0; }
        }
        @keyframes hitPop {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes homerFlash {
          0%, 100% { opacity: 0; }
          30%, 60% { opacity: 1; }
        }
        @keyframes homerShake {
          0%, 100% { transform: translate(0,0); }
          20% { transform: translate(-4px, 2px); }
          40% { transform: translate(4px, -2px); }
          60% { transform: translate(-3px, -2px); }
          80% { transform: translate(3px, 2px); }
        }
        @keyframes contactSpark {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1.4); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
        @keyframes runBases {
          0%   { left: 50%;  top: 92%; opacity: 0; }
          8%   { opacity: 1; }
          25%  { left: 92%;  top: 50%; }
          50%  { left: 50%;  top: 8%;  }
          75%  { left: 8%;   top: 50%; }
          92%  { left: 50%;  top: 92%; opacity: 1; }
          100% { left: 50%;  top: 92%; opacity: 0; }
        }
      `}</style>

      {/* 존 위를 휩쓸고 지나가는 배트 */}
      {swinging && (
        <svg
          className="absolute left-1/2 top-1/2 z-[25] pointer-events-none"
          width="70%" height="70%" viewBox="0 0 200 200"
          style={{
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
            animation: "zoneBatSwing 0.38s ease-out forwards",
          }}
        >
          <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.35)" strokeWidth="14" strokeLinecap="round" />
          <line x1="20" y1="100" x2="180" y2="100" stroke="rgba(255,255,255,0.55)" strokeWidth="8" strokeLinecap="round" />
          <line x1="30" y1="100" x2="175" y2="100" stroke="#78350f" strokeWidth="9" strokeLinecap="round" />
          <line x1="30" y1="100" x2="175" y2="100" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
          <circle cx="30" cy="100" r="6" fill="#111" />
        </svg>
      )}

      {/* 컨택 임팩트 스파크 (스윙 + 안타/홈런/파울일 때 공 위치에) */}
      {swinging && ballPos && (
        <div
          className="absolute z-[28] pointer-events-none"
          style={{
            left: `calc(${(ballPos.x / 5) * 100}% + 10%)`,
            top: `calc(${(ballPos.y / 5) * 100}% + 10%)`,
            animation: "contactSpark 0.5s ease-out forwards",
          }}
        >
          <div className="relative w-16 h-16 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.95), rgba(253,224,71,0.7) 40%, transparent 70%)" }} />
            <div className="absolute inset-0 flex items-center justify-center text-3xl">💥</div>
          </div>
        </div>
      )}

      {/* 홈런 - 팀 유니폼 입은 선수가 베이스를 도는 모션 */}
      {hitLabel?.kind === "homer" && battingTeam && (
        <div
          className="absolute z-[35] pointer-events-none"
          style={{
            width: "36px",
            height: "48px",
            marginLeft: "-18px",
            marginTop: "-40px",
            animation: "runBases 2.6s linear forwards",
          }}
        >
          <RunnerSvg color={battingTeam.color} accent={battingTeam.accent} />
        </div>
      )}

      {/* 결과 텍스트 오버레이 */}
      {hitLabel && (
        <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
          {hitLabel.kind === "homer" && (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: "radial-gradient(circle at center, rgba(253,224,71,0.55), rgba(239,68,68,0.35) 40%, transparent 70%)",
                  animation: "homerFlash 1.2s ease-out",
                }}
              />
              <div className="absolute inset-0" style={{ animation: "homerShake 0.5s ease-in-out" }} />
            </>
          )}
          <div
            className={`px-5 py-2 rounded-xl font-black tracking-widest whitespace-nowrap ${
              hitLabel.kind === "homer"
                ? "text-4xl md:text-5xl text-white bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 shadow-[0_0_40px_rgba(253,224,71,0.9)] border-2 border-yellow-200 -translate-y-16"
                : hitLabel.kind === "triple"
                ? "text-3xl md:text-4xl text-black bg-yellow-300 shadow-2xl border-2 border-yellow-500"
                : hitLabel.kind === "double"
                ? "text-3xl text-white bg-emerald-500 shadow-2xl border-2 border-emerald-200"
                : "text-2xl md:text-3xl text-black bg-white shadow-2xl border-2 border-white/70"
            }`}
            style={{ animation: "hitPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
          >
            {hitLabel.text}
          </div>
        </div>
      )}
    </div>
  );
}

function PitcherSvg({ throws, windup }: { throws: "L" | "R"; windup: boolean }) {
  const flip = throws === "L" ? -1 : 1;
  return (
    <svg width="46" height="60" viewBox="0 0 46 60" style={{ transform: `scaleX(${flip})` }}>
      {/* 유니폼 몸통 */}
      <rect x="15" y="20" width="16" height="22" rx="3" fill="#f5f5f5" stroke="#222" strokeWidth="1" />
      {/* 바지 */}
      <rect x="16" y="40" width="6" height="16" fill="#334155" />
      <rect x="24" y="40" width="6" height="16" fill="#334155" />
      {/* 신발 */}
      <rect x="15" y="55" width="8" height="4" rx="1" fill="#0f172a" />
      <rect x="23" y="55" width="8" height="4" rx="1" fill="#0f172a" />
      {/* 머리 + 모자 */}
      <circle cx="23" cy="14" r="6" fill="#f5d5b0" />
      <path d="M17 12 Q23 5 29 12 L31 14 L15 14 Z" fill="#1e3a8a" />
      <rect x="14" y="13" width="8" height="2" fill="#1e3a8a" />
      {/* 던지는 팔 (와인드업 시 뒤로) */}
      <line x1="31" y1="24" x2={windup ? 42 : 38} y2={windup ? 14 : 32}
        stroke="#f5f5f5" strokeWidth="4" strokeLinecap="round" />
      {/* 글러브 팔 */}
      <line x1="15" y1="26" x2="8" y2="30" stroke="#f5f5f5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="6" cy="31" r="3" fill="#78350f" />
      {/* 공 (와인드업) */}
      {windup && <circle cx="42" cy="14" r="2.5" fill="#fff" stroke="#dc2626" strokeWidth="0.5" />}
    </svg>
  );
}

function RunnerSvg({ color, accent }: { color: string; accent: string }) {
  return (
    <svg width="36" height="48" viewBox="0 0 36 48" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}>
      {/* 다리 (달리는 자세) */}
      <line x1="14" y1="30" x2="8" y2="44" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      <line x1="22" y1="30" x2="28" y2="42" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
      {/* 신발 */}
      <ellipse cx="7" cy="45" rx="4" ry="2" fill="#0f172a" />
      <ellipse cx="29" cy="43" rx="4" ry="2" fill="#0f172a" />
      {/* 유니폼 */}
      <rect x="10" y="14" width="16" height="18" rx="3" fill={color} stroke={accent} strokeWidth="1.5" />
      {/* 등번호 */}
      <text x="18" y="26" fontSize="8" fill="#fff" fontWeight="bold" textAnchor="middle">7</text>
      {/* 팔 (달리는 자세) */}
      <line x1="10" y1="18" x2="4" y2="24" stroke="#f5d5b0" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="26" y1="18" x2="32" y2="12" stroke="#f5d5b0" strokeWidth="3.5" strokeLinecap="round" />
      {/* 머리 + 헬멧 */}
      <circle cx="18" cy="9" r="5" fill="#f5d5b0" />
      <path d="M13 8 Q18 2 23 8 L24 11 L12 11 Z" fill={accent === "#000000" ? "#1e293b" : accent} />
    </svg>
  );
}

function BatterSvg({ bats, swinging }: { bats: "L" | "R" | "S"; swinging: boolean }) {
  const flip = bats === "L" ? -1 : 1;
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" style={{ transform: `scaleX(${flip})` }}>
      {/* 다리 */}
      <rect x="22" y="50" width="6" height="24" fill="#334155" />
      <rect x="32" y="50" width="6" height="24" fill="#334155" />
      {/* 신발 */}
      <rect x="20" y="72" width="10" height="5" rx="1" fill="#0f172a" />
      <rect x="30" y="72" width="10" height="5" rx="1" fill="#0f172a" />
      {/* 유니폼 */}
      <rect x="18" y="26" width="22" height="26" rx="3" fill="#dc2626" stroke="#222" strokeWidth="1" />
      {/* 등번호 */}
      <text x="29" y="42" fontSize="10" fill="white" fontWeight="bold" textAnchor="middle">7</text>
      {/* 머리 + 헬멧 */}
      <circle cx="29" cy="18" r="7" fill="#f5d5b0" />
      <path d="M22 16 Q29 6 36 16 L37 19 L21 19 Z" fill="#1e293b" />
      {/* 팔 + 배트 */}
      {swinging ? (
        <>
          <line x1="40" y1="30" x2="55" y2="28" stroke="#f5d5b0" strokeWidth="4" strokeLinecap="round" />
          <line x1="18" y1="30" x2="5" y2="28" stroke="#f5d5b0" strokeWidth="4" strokeLinecap="round" />
          {/* 스윙한 배트 (수평) */}
          <line x1="55" y1="28" x2="2" y2="20" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="40" y1="30" x2="46" y2="20" stroke="#f5d5b0" strokeWidth="4" strokeLinecap="round" />
          <line x1="18" y1="30" x2="42" y2="16" stroke="#f5d5b0" strokeWidth="4" strokeLinecap="round" />
          {/* 준비 자세 배트 (위로) */}
          <line x1="46" y1="20" x2="55" y2="-8" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}



// ---------- Diamond ----------
function Diamond({ bases }: { bases: [boolean, boolean, boolean] }) {
  return (
    <div className="mt-4 rounded-xl bg-emerald-900/40 border border-white/10 p-4 flex items-center justify-center">
      <div className="relative w-40 h-40">
        <div className="absolute inset-0 rotate-45 border-2 border-white/30" />
        {/* 1루 (오른쪽) */}
        <div className={`absolute top-1/2 right-0 -translate-y-1/2 w-5 h-5 rotate-45 border-2 ${bases[0] ? "bg-yellow-300 border-yellow-100" : "bg-transparent border-white/50"}`} />
        {/* 2루 (위) */}
        <div className={`absolute left-1/2 top-0 -translate-x-1/2 w-5 h-5 rotate-45 border-2 ${bases[1] ? "bg-yellow-300 border-yellow-100" : "bg-transparent border-white/50"}`} />
        {/* 3루 (왼쪽) */}
        <div className={`absolute top-1/2 left-0 -translate-y-1/2 w-5 h-5 rotate-45 border-2 ${bases[2] ? "bg-yellow-300 border-yellow-100" : "bg-transparent border-white/50"}`} />
        {/* 홈 */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-5 h-5 rotate-45 border-2 border-white bg-white/40" />
      </div>
    </div>
  );
}

// ---------- Result ----------
function Result({ userTeam, cpuTeam, scoreUser, scoreCpu, onFinish }: {
  userTeam: Team; cpuTeam: Team; scoreUser: number; scoreCpu: number; onFinish: () => void;
}) {
  const win = scoreUser > scoreCpu;
  const tie = scoreUser === scoreCpu;
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-stone-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">{tie ? "🤝" : win ? "🏆" : "😢"}</div>
        <h1 className="text-3xl font-black mb-2">{tie ? "무승부" : win ? "승리!" : "패배"}</h1>
        <div className="flex items-center justify-center gap-6 mt-6 mb-8">
          <div className="text-center">
            <div className="text-xs opacity-70">{cpuTeam.name}</div>
            <div className="text-4xl font-black tabular-nums">{scoreCpu}</div>
          </div>
          <div className="text-white/40">:</div>
          <div className="text-center">
            <div className="text-xs opacity-70">{userTeam.name}</div>
            <div className="text-4xl font-black tabular-nums">{scoreUser}</div>
          </div>
        </div>
        <button
          onClick={onFinish}
          className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-bold hover:bg-yellow-300"
        >
          다시 경기하기
        </button>
      </div>
    </div>
  );
}

void useMemo;
