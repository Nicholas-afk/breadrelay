import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateScenario } from "../src/domain/scenario.ts";
import { solve } from "../src/planner/solve.ts";
import type { Scenario, Plan } from "../src/domain/types.ts";
const demo: Scenario = JSON.parse(
  readFileSync(new URL("../src/fixtures/demo.json", import.meta.url), "utf8"),
);
const plan = (
  s: Scenario,
  prior: Record<string, string> = {},
  required?: string,
): Plan => {
  const r = solve(s, prior, required);
  if (!r.ok) assert.fail(r.reason);
  return r.plan;
};
test("accepts bounded round and rejects invalid weights and incomplete travel data", () => {
  assert.equal(validateScenario(demo).ok, true);
  const bad = structuredClone(demo);
  bad.pickups[0].weightGrams = -1;
  delete bad.travelMinutes.hub[bad.pickups[0].id];
  const r = validateScenario(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.length, 2);
});
test("schedules 38 kg initially, then 26 kg after cancellation; forcing an excluded pickup costs 3 kg", () => {
  const before = plan(demo);
  assert.equal(before.scheduledGrams, 38000);
  const prior = Object.fromEntries(
    before.routes.flatMap((r) => r.pickupIds.map((id) => [id, r.volunteerId])),
  );
  const changed = structuredClone(demo);
  changed.volunteers[0].available = false;
  const after = plan(changed, prior);
  assert.equal(after.scheduledGrams, 26000);
  assert.equal(after.retainedCount, 2);
  const excluded = changed.pickups.find(
    (p) => !after.assignedIds.includes(p.id),
  )!;
  assert.equal(plan(changed, prior, excluded.id).scheduledGrams, 23000);
});
test("no available crew yields an honest empty plan and no forced-pickup plan", () => {
  const s = structuredClone(demo);
  s.volunteers.forEach((v) => (v.available = false));
  assert.equal(plan(s).scheduledGrams, 0);
  assert.equal(solve(s, {}, s.pickups[0].id).ok, false);
});
