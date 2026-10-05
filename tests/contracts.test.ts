import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateScenario } from "../src/domain/scenario.ts";
import { parseRound } from "../src/io/round-file.ts";
import { calculate } from "../src/planner/calculate.ts";
import { validatePlan } from "../src/planner/validate-plan.ts";
import type { Scenario } from "../src/domain/types.ts";
const demo: Scenario = JSON.parse(
  readFileSync(new URL("../src/fixtures/demo.json", import.meta.url), "utf8"),
);
test("round validation covers duplicates, decimals, missing data, overnight shifts and size bounds", () => {
  const mutations: ((s: Scenario) => void)[] = [
    (s) => {
      s.pickups[1].id = s.pickups[0].id;
    },
    (s) => {
      s.pickups[0].weightGrams = 4.5;
    },
    (s) => {
      s.pickups[0].weightGrams = Infinity;
    },
    (s) => {
      s.travelMinutes.hub.unknown = 7;
    },
    (s) => {
      delete s.travelMinutes.hub;
    },
    (s) => {
      s.volunteers[0].endMinute = 1;
    },
    (s) => {
      s.pickups[0].closeMinute = 0;
    },
    (s) => {
      s.serviceDate = "2026-02-30";
    },
    (s) => {
      s.pickups.push(...s.pickups);
    },
    (s) => {
      s.volunteers.push(...s.volunteers);
    },
  ];
  for (const mutate of mutations) {
    const s = structuredClone(demo);
    mutate(s);
    assert.equal(validateScenario(s).ok, false);
  }
  const s = structuredClone(demo);
  s.pickups = [];
  s.volunteers = [];
  s.travelMinutes = { hub: { hub: 0 } };
  assert.equal(validateScenario(s).ok, true);
  const original = JSON.stringify(demo);
  assert.equal(parseRound("{bad").ok, false);
  assert.equal(parseRound(" ".repeat(256 * 1024 + 1)).ok, false);
  assert.equal(JSON.stringify(demo), original);
});
test("comparison keeps only feasible unchanged routes; explanations and returned schedules pass independent checks", () => {
  const changed = structuredClone(demo);
  changed.volunteers[0].available = false;
  const c = calculate(changed, demo, null);
  assert.equal(c.baseline.plan.scheduledGrams, 18000);
  assert.equal(c.recovery.scheduledGrams, 26000);
  assert.equal(c.explanations.length, 3);
  assert.ok(c.explanations.every((e) => e.lossGrams === 3000));
  const delayed = structuredClone(demo);
  delayed.volunteers.forEach((v) => (v.startMinute += 35));
  const d = calculate(delayed, demo, null);
  assert.equal(d.baseline.plan.scheduledGrams, 0);
  assert.equal(d.baseline.droppedRoutes.length, 2);
  const bad = structuredClone(c.referencePlan);
  bad.routes[0].stops[0].departMinute++;
  assert.equal(validatePlan(demo, bad).ok, false);
  const totals = structuredClone(c.referencePlan);
  totals.scheduledGrams++;
  assert.equal(validatePlan(demo, totals).ok, false);
});
test("data provenance rejects coercible non-string JSON values", () => {
  for (const dataKind of [
    ["synthetic"],
    ["operator"],
    { toString: "synthetic" },
    true,
    null,
  ])
    assert.equal(validateScenario({ ...demo, dataKind }).ok, false);
});
