import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { calculate, assignments } from "../src/planner/calculate.ts";
import { simulateRoute } from "../src/domain/simulate.ts";
import { validateScenario } from "../src/domain/scenario.ts";
import { validatePlan } from "../src/planner/validate-plan.ts";
import type {
  Scenario,
  Plan,
  PriorAssignments,
  Route,
} from "../src/domain/types.ts";

const initialSeed = 20261006;
let seed = initialSeed;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const integer = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
function synthetic(index: number): Scenario {
  const ids = [
    "hub",
    ...Array.from(
      { length: 6 },
      (_, i) => "pickup-" + String.fromCharCode(97 + i),
    ),
  ];
  const points = ids.map((_, i) =>
    i ? [integer(0, 20), integer(0, 20)] : [0, 0],
  );
  const travelMinutes = Object.fromEntries(
    ids.map((a, i) => [
      a,
      Object.fromEntries(
        ids.map((b, j) => [
          b,
          i === j
            ? 0
            : Math.ceil(
                Math.hypot(
                  points[i][0] - points[j][0],
                  points[i][1] - points[j][1],
                ),
              ) + (index % 2 ? integer(0, 5) : 0),
        ]),
      ),
    ]),
  );
  return {
    schemaVersion: 1,
    title: `Synthetic evaluation round ${index}`,
    serviceDate: "2026-10-06",
    timezone: "Asia/Hong_Kong",
    dataKind: "synthetic",
    travelSource:
      "Seeded illustrative coordinates/minutes, not roads or observed collections",
    hub: { id: "hub", label: "Hub" },
    maxStops: 3,
    travelMinutes,
    pickups: ids.slice(1).map((id) => {
      const ready = 1140 + integer(0, 25),
        close = ready + integer(20, 70);
      return {
        id,
        label: id,
        weightGrams: integer(2, 12) * 1000,
        readyMinute: ready,
        closeMinute: close,
        serviceMinutes: integer(0, 5),
        hubDeadlineMinute: close + integer(5, 30),
      };
    }),
    volunteers: ["crew-a", "crew-b"].map((id) => ({
      id,
      label: id,
      capacityGrams: integer(15, 30) * 1000,
      startMinute: 1140 + integer(0, 10),
      endMinute: 1240,
      available: true,
    })),
  };
}
// Defined comparator: descending weight, insert each whole pickup at the least-travel feasible position.
// It shares the feasibility simulator; it is not an independent correctness oracle or a vendor benchmark.
function greedy(s: Scenario, prior: PriorAssignments): Plan {
  const routes = new Map<string, Route>();
  for (const pickup of [...s.pickups].sort(
    (a, b) =>
      b.weightGrams - a.weightGrams ||
      a.closeMinute - b.closeMinute ||
      a.id.localeCompare(b.id),
  )) {
    let best: Route | undefined;
    for (const v of s.volunteers.filter((v) => v.available)) {
      const ids = routes.get(v.id)?.pickupIds ?? [];
      if (ids.length >= s.maxStops) continue;
      for (let position = 0; position <= ids.length; position++) {
        const next = [...ids];
        next.splice(position, 0, pickup.id);
        const candidate = simulateRoute(s, v, next);
        if (
          candidate &&
          (!best ||
            candidate.travelMinutes < best.travelMinutes ||
            (candidate.travelMinutes === best.travelMinutes &&
              `${candidate.volunteerId}:${candidate.pickupIds.join("|")}` <
                `${best.volunteerId}:${best.pickupIds.join("|")}`))
        )
          best = candidate;
      }
    }
    if (best) routes.set(best.volunteerId, best);
  }
  const selected = [...routes.values()];
  return {
    routes: selected,
    assignedIds: selected.flatMap((r) => r.pickupIds).sort(),
    scheduledGrams: selected.reduce((n, r) => n + r.weightGrams, 0),
    retainedCount: selected.reduce(
      (n, r) =>
        n + r.pickupIds.filter((id) => prior[id] === r.volunteerId).length,
      0,
    ),
    travelMinutes: selected.reduce((n, r) => n + r.travelMinutes, 0),
  };
}
const demo: Scenario = JSON.parse(
  readFileSync(new URL("../src/fixtures/demo.json", import.meta.url), "utf8"),
);
const cancelled = structuredClone(demo);
cancelled.volunteers[0].available = false;
const example = calculate(cancelled, demo, null);
assert.equal(example.baseline.plan.scheduledGrams, 18000);
assert.equal(example.recovery.scheduledGrams, 26000);
const cases = [];
for (let index = 0; index < 100; index++) {
  const reference = synthetic(index);
  assert.equal(validateScenario(reference).ok, true);
  const current = structuredClone(reference);
  current.volunteers[index % 2].available = false;
  const c = calculate(current, reference, null),
    prior = assignments(c.referencePlan),
    g = greedy(current, prior);
  assert.equal(validatePlan(current, g, prior).ok, true);
  assert.ok(c.recovery.scheduledGrams >= c.baseline.plan.scheduledGrams);
  assert.ok(c.recovery.scheduledGrams >= g.scheduledGrams);
  cases.push({
    index,
    reference,
    current,
    referenceGrams: c.referencePlan.scheduledGrams,
    unchangedGrams: c.baseline.plan.scheduledGrams,
    greedyGrams: g.scheduledGrams,
    revisedGrams: c.recovery.scheduledGrams,
    unchangedTravelMinutes: c.baseline.plan.travelMinutes,
    greedyTravelMinutes: g.travelMinutes,
    revisedTravelMinutes: c.recovery.travelMinutes,
    retainedAssignments: c.recovery.retainedCount,
  });
}
const total = (key: "unchangedGrams" | "greedyGrams" | "revisedGrams") =>
  cases.reduce((n, c) => n + c[key], 0);
const summary = {
  cases: cases.length,
  seed: initialSeed,
  unchangedTotalGrams: total("unchangedGrams"),
  greedyTotalGrams: total("greedyGrams"),
  revisedTotalGrams: total("revisedGrams"),
  improvedOverUnchanged: cases.filter((c) => c.revisedGrams > c.unchangedGrams)
    .length,
  equalToUnchanged: cases.filter((c) => c.revisedGrams === c.unchangedGrams)
    .length,
  improvedOverGreedy: cases.filter((c) => c.revisedGrams > c.greedyGrams)
    .length,
  equalToGreedy: cases.filter((c) => c.revisedGrams === c.greedyGrams).length,
  averageGainOverUnchangedGrams:
    (total("revisedGrams") - total("unchangedGrams")) / 100,
  averageGainOverGreedyGrams:
    (total("revisedGrams") - total("greedyGrams")) / 100,
};
const report = {
  kind: "Synthetic before-departure cancellation comparison",
  completedAt: new Date().toISOString(),
  runtime: process.version,
  parameters: {
    pickups: 6,
    volunteersBefore: 2,
    volunteersAfter: 1,
    maxStops: 3,
    symmetricCases: 50,
    directedCases: 50,
    seed: initialSeed,
    cases: 100,
  },
  baselineDefinitions: {
    unchanged:
      "Keep each available original route in its original order if fully feasible; drop an invalid/unavailable whole route",
    greedy:
      "Descending weight, then earlier closing/ID; insert each pickup into the least-travel feasible position; no global subset search",
    revised:
      "Exact grams, then retained assignments, then travel, then stable IDs",
  },
  summary,
  limits:
    "Generated data only; not real operators, observed cancellations, actual delivered food, vendor performance, or representative field-effect estimates. Greedy uses the same feasibility simulator and separate returned-plan validator. Correctness evidence is separately supplied by the independent 350-case oracle.",
  cases,
};
const output = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
mkdirSync(output, { recursive: true });
writeFileSync(
  resolve(output, "EVALUATION_BASELINES.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ summary, limits: report.limits }, null, 2));
