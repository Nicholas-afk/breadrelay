import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseRound } from "../src/io/round-file.ts";
import { createReport } from "../src/io/report.ts";
import { calculate } from "../src/planner/calculate.ts";
import type { Scenario } from "../src/domain/types.ts";
const demo: Scenario = JSON.parse(
  readFileSync(new URL("../src/fixtures/demo.json", import.meta.url), "utf8"),
);

test("a saved cancellation report restores its two scenarios and recomputes, ignoring forged plans", () => {
  const current = structuredClone(demo);
  current.volunteers[0].available = false;
  const report = createReport(demo, current, calculate(current, demo, null));
  report.recovery.scheduledGrams = 999999;
  report.referencePlan.routes = [];
  const parsed = parseRound(JSON.stringify(report));
  if (!parsed.ok) assert.fail(JSON.stringify(parsed.errors));
  assert.equal(parsed.value.restoredReport, true);
  const recomputed = calculate(
    parsed.value.currentScenario,
    parsed.value.referenceScenario,
    null,
  );
  assert.equal(recomputed.referencePlan.scheduledGrams, 38000);
  assert.equal(recomputed.baseline.plan.scheduledGrams, 18000);
  assert.equal(recomputed.recovery.scheduledGrams, 26000);
  assert.ok(recomputed.explanations.every((e) => e.lossGrams === 3000));
});

test("scenario files start a fresh reference; broken or unrelated reports are rejected", () => {
  const round = parseRound(JSON.stringify(demo));
  assert.equal(round.ok, true);
  if (!round.ok) assert.fail();
  assert.equal(round.value.restoredReport, false);
  assert.deepEqual(round.value.referenceScenario, demo);
  assert.deepEqual(round.value.currentScenario, demo);
  const original = JSON.stringify(demo);
  const report = createReport(demo, demo, calculate(demo, demo, null));
  for (const mutate of [
    (r: typeof report) => {
      r.version = 2;
    },
    (r: typeof report) => {
      r.currentScenario.serviceDate = "2026-10-07";
    },
    (r: typeof report) => {
      r.currentScenario.pickups.pop();
    },
    (r: typeof report) => {
      delete r.currentScenario.travelMinutes.hub["bakery-a"];
    },
    (r: typeof report) => {
      r.referenceScenario.volunteers[0].startMinute = -1;
    },
  ]) {
    const value: typeof report = JSON.parse(JSON.stringify(report));
    mutate(value);
    assert.equal(parseRound(JSON.stringify(value)).ok, false);
  }
  assert.equal(JSON.stringify(demo), original);
});
