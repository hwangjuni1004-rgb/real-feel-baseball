import { batterValue, pitcherValue, TEAMS } from "./kbo-data";
import { MIN_BATTERS, MIN_PITCHERS, type MarketState, type Roster } from "./market";

export type TradePlayer = { kind: "B" | "P"; name: string };
export type TradeProposal = { user: string; other: string; give: TradePlayer; receive: TradePlayer };

export function tradePlayers(roster: Roster): TradePlayer[] {
  return [...roster.lineup.map((p) => ({ kind: "B" as const, name: p.name })),
    ...roster.rotation.map((p) => ({ kind: "P" as const, name: p.name }))];
}

export function tradeValue(roster: Roster, player: TradePlayer): number {
  if (player.kind === "B") {
    const batter = roster.lineup.find((p) => p.name === player.name);
    return batter ? batterValue(batter) : 0;
  }
  const pitcher = roster.rotation.find((p) => p.name === player.name);
  return pitcher ? pitcherValue(pitcher) : 0;
}

function swapRoster(roster: Roster, outgoing: TradePlayer, incoming: TradePlayer, source: Roster): Roster {
  const batter = incoming.kind === "B" ? source.lineup.find((p) => p.name === incoming.name) : undefined;
  const pitcher = incoming.kind === "P" ? source.rotation.find((p) => p.name === incoming.name) : undefined;
  return {
    lineup: [...roster.lineup.filter((p) => outgoing.kind !== "B" || p.name !== outgoing.name), ...(batter ? [batter] : [])],
    rotation: [...roster.rotation.filter((p) => outgoing.kind !== "P" || p.name !== outgoing.name), ...(pitcher ? [pitcher] : [])],
  };
}

export function evaluateTrade(market: MarketState, proposal: TradeProposal): { valid: boolean; probability: number; reason: string } {
  const { user, other, give, receive } = proposal;
  const own = market.rosters[user];
  const theirs = market.rosters[other];
  if (!own || !theirs || user === other) return { valid: false, probability: 0, reason: "다른 구단을 선택하세요." };
  const givenValue = tradeValue(own, give);
  const receivedValue = tradeValue(theirs, receive);
  if (!givenValue || !receivedValue) return { valid: false, probability: 0, reason: "선수 소속이 변경되었습니다. 다시 선택하세요." };
  const nextOwn = swapRoster(own, give, receive, theirs);
  const nextOther = swapRoster(theirs, receive, give, own);
  if ([nextOwn, nextOther].some((r) => r.lineup.length < MIN_BATTERS || r.rotation.length < MIN_PITCHERS)) {
    return { valid: false, probability: 0, reason: "교환 후 각 팀에 타자 9명·투수 5명 이상이 남아야 합니다." };
  }
  const incomingBatter = give.kind === "B" ? own.lineup.find((p) => p.name === give.name) : undefined;
  const samePosition = incomingBatter ? theirs.lineup.filter((p) => p.pos === incomingBatter.pos && p.name !== receive.name) : [];
  const need = give.kind === "P" ? (theirs.rotation.length < 9 ? 1.15 : 1)
    : samePosition.length === 0 ? 1.15 : 1;
  const ratio = givenValue * need / receivedValue;
  const probability = Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-4 * (ratio - 1)))));
  return { valid: true, probability, reason: ratio > 1.1 ? "상대 팀에 유리한 제안" : ratio < 0.9 ? "상대 팀에 불리한 제안" : "가치가 비슷한 제안" };
}

export function proposeTrade(market: MarketState, proposal: TradeProposal, random: () => number = Math.random) {
  const evaluation = evaluateTrade(market, proposal);
  if (!evaluation.valid) return { market, accepted: false, message: evaluation.reason };
  const { user, other, give, receive } = proposal;
  const own = market.rosters[user];
  const theirs = market.rosters[other];
  if (!own || !theirs) return { market, accepted: false, message: "구단을 찾을 수 없습니다." };
  const otherName = TEAMS.find((t) => t.id === other)?.short ?? other;
  const ownName = TEAMS.find((t) => t.id === user)?.short ?? user;
  const accepted = random() < evaluation.probability;
  const message = accepted
    ? `${ownName}와 ${otherName} 트레이드 성사! ${give.name} → ${otherName}, ${receive.name} → ${ownName}`
    : `${otherName}이(가) ${give.name} ↔ ${receive.name} 트레이드를 거절했습니다.`;
  const rosters = accepted ? { ...market.rosters,
    [user]: swapRoster(own, give, receive, theirs), [other]: swapRoster(theirs, receive, give, own),
  } : market.rosters;
  return { accepted, message, market: { ...market, rosters,
    listings: accepted ? market.listings.filter((l) => !((l.from === user && (l.batter?.name ?? l.pitcher?.name) === give.name)
      || (l.from === other && (l.batter?.name ?? l.pitcher?.name) === receive.name))) : market.listings,
    news: [message, ...market.news].slice(0, 60),
  } };
}