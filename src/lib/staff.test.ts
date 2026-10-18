/// <reference types="bun" />
import { test, expect } from "bun:test";
import { TEAMS } from "./kbo-data";
import { createMarket } from "./market";
import { applyStaff, changeStaff, createStaff, staffBonus } from "./staff";

const setup = () => {
  const team = TEAMS[0];
  if (!team) throw new Error("No team");
  const market = createMarket(team.id);
  market.money[team.id] = 10000;
  return { team, market, staff: createStaff() };
};
test("영입은 자금 차감과 소유권을 함께 반영", () => {
  const { team, market, staff } = setup();
  const result = changeStaff(market, staff, team.id, "m1", "hire");
  expect(result.ok).toBe(true);
  expect(result.market.money[team.id]).toBe(8400);
  expect(result.staff[team.id]).toEqual(["m1"]);
  expect(market.money[team.id]).toBe(10000);
});
test("보직 중복 및 다른 팀의 중복 계약 방지", () => {
  const { team, market, staff } = setup();
  const r = changeStaff(market, staff, team.id, "m1", "hire");
  expect(changeStaff(r.market, r.staff, team.id, "m2", "hire").ok).toBe(false);
  const rival = TEAMS[1];
  if (!rival) throw new Error("No rival");
  expect(changeStaff(r.market, r.staff, rival.id, "m1", "hire").ok).toBe(false);
});
test("잔액 부족이면 자금과 코치진 불변", () => {
  const { team, market, staff } = setup();
  market.money[team.id] = 0;
  const r = changeStaff(market, staff, team.id, "m1", "hire");
  expect(r.ok).toBe(false);
  expect(r.market).toBe(market);
  expect(r.staff).toBe(staff);
});
test("방출은 영입가 절반 회수, 반복 방출 불가", () => {
  const { team, market, staff } = setup();
  const hired = changeStaff(market, staff, team.id, "m1", "hire");
  const released = changeStaff(hired.market, hired.staff, team.id, "m1", "release");
  expect(released.market.money[team.id]).toBe(9200);
  expect(released.staff[team.id]).toEqual([]);
  expect(changeStaff(released.market, released.staff, team.id, "m1", "release").ok).toBe(false);
});
test("코치 능력 적용은 원본과 구속을 유지하고 능력 상한 10 준수", () => {
  const { team, staff } = setup();
  staff[team.id] = ["m2", "b2", "p2", "f2"];
  expect(staffBonus(staff, team.id)).toEqual({ contact: 4, power: 2, control: 4, defense: 2 });
  const boosted = applyStaff(team, staff);
  expect(boosted.lineup[0]?.contact).toBe(Math.min(10, (team.lineup[0]?.contact ?? 0) + 4));
  expect(boosted.rotation[0]?.control).toBe(Math.min(10, (team.rotation[0]?.control ?? 0) + 4));
  expect(boosted.rotation[0]?.velo).toBe(team.rotation[0]?.velo);
  expect(boosted.lineup).not.toBe(team.lineup);
  expect(applyStaff(team, createStaff()).lineup[0]?.contact).toBe(team.lineup[0]?.contact);
});