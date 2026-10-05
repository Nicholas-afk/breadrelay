import test from "node:test";
import assert from "node:assert/strict";
import { solve } from "../src/planner/solve.ts";
import { calculate } from "../src/planner/calculate.ts";
import { simulateRoute } from "../src/domain/simulate.ts";
import { validatePlan } from "../src/planner/validate-plan.ts";
import type { Scenario, Plan } from "../src/domain/types.ts";
function tiny(): Scenario {
  return {
    schemaVersion: 1,
    title: "Hand-checked edge fixture",
    serviceDate: "2026-10-06",
    timezone: "Asia/Hong_Kong",
    dataKind: "synthetic",
    travelSource: "Synthetic hand-checked values",
    hub: { id: "hub", label: "Hub" },
    maxStops: 3,
    pickups: ["pickup-a", "pickup-b"].map((id) => ({
      id,
      label: id,
      weightGrams: 1000,
      readyMinute: 600,
      closeMinute: 660,
      serviceMinutes: 2,
      hubDeadlineMinute: 680,
    })),
    volunteers: [
      {
        id: "crew-a",
        label: "A",
        capacityGrams: 1000,
        startMinute: 600,
        endMinute: 680,
        available: true,
      },
    ],
    travelMinutes: {
      hub: { hub: 0, "pickup-a": 5, "pickup-b": 5 },
      "pickup-a": { hub: 5, "pickup-a": 0, "pickup-b": 5 },
      "pickup-b": { hub: 5, "pickup-a": 5, "pickup-b": 0 },
    },
  };
}
function plan(s: Scenario, prior = {}): Plan {
  const result = solve(s, prior);
  if (!result.ok) assert.fail();
  return result.plan;
}
test("equal plans use stable pickup IDs regardless of input order; tie explanation identifies stable order", () => {
  const s = tiny();
  assert.deepEqual(plan(s).assignedIds, ["pickup-a"]);
  s.pickups.reverse();
  assert.deepEqual(plan(s).assignedIds, ["pickup-a"]);
  const reference = structuredClone(s);
  reference.volunteers[0].capacityGrams = 2000;
  const c = calculate(s, reference, null);
  assert.equal(c.explanations[0].kind, "tie");
  assert.equal(c.explanations[0].lossGrams, 0);
  assert.match(c.explanations[0].summary, /stable ID/);
});
test("retention outranks travel, while weight outranks retention", () => {
  const s = tiny();
  s.travelMinutes.hub["pickup-b"] = 10;
  assert.deepEqual(plan(s, { "pickup-b": "crew-a" }).assignedIds, ["pickup-b"]);
  s.pickups[0].weightGrams = 1001;
  s.volunteers[0].capacityGrams = 1001;
  assert.deepEqual(plan(s, { "pickup-b": "crew-a" }).assignedIds, ["pickup-a"]);
});
test("a prefix with an impossible return can extend into a feasible non-metric directed route", () => {
  const s = tiny();
  s.volunteers[0].capacityGrams = 2000;
  s.volunteers[0].endMinute = 625;
  s.travelMinutes["pickup-a"].hub = 60;
  s.travelMinutes["pickup-a"]["pickup-b"] = 2;
  s.travelMinutes["pickup-b"]["pickup-a"] = 60;
  assert.equal(simulateRoute(s, s.volunteers[0], ["pickup-a"]), null);
  const p = plan(s);
  assert.deepEqual(p.routes[0].pickupIds, ["pickup-a", "pickup-b"]);
  assert.equal(p.routes[0].returnMinute, 616);
  assert.equal(p.travelMinutes, 12);
  assert.equal(validatePlan(s, p).ok, true);
});
test("waiting, collection completion, capacity and hub deadlines include exact boundary minutes", () => {
  const s = tiny();
  s.pickups = [s.pickups[0]];
  s.travelMinutes = {
    hub: { hub: 0, "pickup-a": 5 },
    "pickup-a": { hub: 5, "pickup-a": 0 },
  };
  s.pickups[0].readyMinute = 610;
  s.pickups[0].closeMinute = 612;
  s.pickups[0].hubDeadlineMinute = 617;
  const route = simulateRoute(s, s.volunteers[0], ["pickup-a"]);
  assert.ok(route);
  assert.equal(route.stops[0].arrivalMinute, 605);
  assert.equal(route.stops[0].waitMinutes, 5);
  assert.equal(route.stops[0].departMinute, 612);
  assert.equal(route.stops[0].loadAfterGrams, 1000);
  assert.equal(route.returnMinute, 617);
  assert.equal(route.hubSlackMinutes, 0);
  s.pickups[0].hubDeadlineMinute = 616;
  assert.equal(simulateRoute(s, s.volunteers[0], ["pickup-a"]), null);
  s.pickups[0].hubDeadlineMinute = 617;
  s.volunteers[0].capacityGrams = 999;
  assert.equal(simulateRoute(s, s.volunteers[0], ["pickup-a"]), null);
});
