import { TEAMS, fieldingAt, type Team } from "./kbo-data";
import type { MarketState } from "./market";

export type StaffRole = "manager" | "batting" | "pitching" | "fielding";
export type StaffMember = { id: string; name: string; role: StaffRole; price: number; bonus: number };
export type StaffState = Record<string, string[]>;
export const STAFF_ROLES: Record<StaffRole, string> = { manager: "감독", batting: "타격 코치", pitching: "투수 코치", fielding: "수비 코치" };
// Fictional staff and game-balance prices, not real-world contracts.
export const STAFF: StaffMember[] = [
  { id: "m1", name: "한도윤", role: "manager", price: 1600, bonus: 1 },
  { id: "m2", name: "강태오", role: "manager", price: 3200, bonus: 2 },
  { id: "b1", name: "윤성재", role: "batting", price: 1200, bonus: 1 },
  { id: "b2", name: "백승호", role: "batting", price: 2400, bonus: 2 },
  { id: "p1", name: "서지훈", role: "pitching", price: 1200, bonus: 1 },
  { id: "p2", name: "차민석", role: "pitching", price: 2400, bonus: 2 },
  { id: "f1", name: "임건우", role: "fielding", price: 1000, bonus: 1 },
  { id: "f2", name: "오현준", role: "fielding", price: 2000, bonus: 2 },
];
export const createStaff = (): StaffState => Object.fromEntries(TEAMS.map(t => [t.id, []]));
export const staffMembers = (state: StaffState, team: string) => STAFF.filter(s => state[team]?.includes(s.id));
export function staffBonus(state: StaffState, team: string) {
  const members = staffMembers(state, team);
  const bonus = (role: StaffRole) => members.find(s => s.role === role)?.bonus ?? 0;
  return { contact: bonus("manager") + bonus("batting"), power: bonus("batting"), control: bonus("manager") + bonus("pitching"), defense: bonus("fielding") };
}
export function applyStaff(team: Team, state: StaffState): Team {
  const b = staffBonus(state, team.id);
  const cap = (v: number) => Math.min(10, v);
  return { ...team,
    lineup: team.lineup.map(p => ({ ...p, contact: cap(p.contact + b.contact), power: cap(p.power + b.power), defense: cap(fieldingAt(p, p.pos) + b.defense) })),
    rotation: team.rotation.map(p => ({ ...p, control: cap(p.control + b.control) })),
  };
}
export function changeStaff(market: MarketState, staff: StaffState, team: string, id: string, action: "hire" | "release") {
  const member = STAFF.find(s => s.id === id);
  const fail = (message: string) => ({ market, staff, message, ok: false });
  if (!member || !market.rosters[team]) return fail("코치진 정보를 찾을 수 없습니다.");
  const owned = staff[team] ?? [];
  const balance = market.money[team] ?? 0;
  if (action === "hire") {
    if (Object.values(staff).some(ids => ids.includes(id))) return fail("이미 계약한 코치진입니다.");
    if (staffMembers(staff, team).some(s => s.role === member.role)) return fail("같은 보직의 코치진을 먼저 방출하세요.");
    if (balance < member.price) return fail("영입 자금이 부족합니다.");
  } else if (!owned.includes(id)) return fail("우리 팀 코치진이 아닙니다.");
  const amount = action === "hire" ? -member.price : Math.floor(member.price / 2);
  const name = TEAMS.find(t => t.id === team)?.short ?? team;
  const message = `${name}: ${member.name} ${STAFF_ROLES[member.role]} ${action === "hire" ? "영입" : "방출"} · ${Math.abs(amount).toLocaleString()}만 달러 ${action === "hire" ? "지출" : "회수"}`;
  return { ok: true, message,
    staff: { ...staff, [team]: action === "hire" ? [...owned, id] : owned.filter(s => s !== id) },
    market: { ...market, money: { ...market.money, [team]: balance + amount }, news: [message, ...market.news].slice(0, 100) },
  };
}