import type {
  Scenario,
  Plan,
  PriorAssignments,
  Baseline,
  Explanation,
  Calculation,
} from "../domain/types.ts";
import { simulateRoute } from "../domain/simulate.ts";
import { validateScenario } from "../domain/scenario.ts";
import { validatePlan } from "./validate-plan.ts";
import { solve } from "./solve.ts";
export const assignments = (p: Plan): PriorAssignments =>
  Object.fromEntries(
    p.routes.flatMap((r) => r.pickupIds.map((id) => [id, r.volunteerId])),
  );
function checked(
  s: Scenario,
  prior: PriorAssignments = {},
  required?: string,
): Plan | null {
  const r = solve(s, prior, required);
  if (!r.ok) return null;
  if (!validatePlan(s, r.plan, prior).ok)
    throw Error("The calculated plan failed its independent route check.");
  return r.plan;
}
export function buildBaseline(
  s: Scenario,
  reference: Plan,
  prior: PriorAssignments,
): Baseline {
  const routes: Plan["routes"] = [],
    droppedRoutes: Baseline["droppedRoutes"] = [];
  for (const old of reference.routes) {
    const v = s.volunteers.find((v) => v.id === old.volunteerId);
    const route = v ? simulateRoute(s, v, old.pickupIds) : null;
    if (route) routes.push(route);
    else
      droppedRoutes.push({
        volunteerId: old.volunteerId,
        reason:
          !v || !v.available
            ? "Volunteer unavailable"
            : "Starting route no longer meets the current limits",
      });
  }
  const plan: Plan = {
    routes,
    assignedIds: routes.flatMap((r) => r.pickupIds).sort(),
    scheduledGrams: routes.reduce((n, r) => n + r.weightGrams, 0),
    retainedCount: routes.reduce(
      (n, r) =>
        n + r.pickupIds.filter((id) => prior[id] === r.volunteerId).length,
      0,
    ),
    travelMinutes: routes.reduce((n, r) => n + r.travelMinutes, 0),
  };
  if (!validatePlan(s, plan, prior).ok)
    throw Error("The unchanged-route comparison failed validation.");
  return { plan, droppedRoutes };
}
export function calculate(
  s: Scenario,
  referenceScenario: Scenario,
  referencePlan: Plan | null,
): Calculation {
  const start = performance.now();
  if (!validateScenario(s).ok || !validateScenario(referenceScenario).ok)
    throw Error("The round contains invalid inputs.");
  const reference = referencePlan ?? checked(referenceScenario)!;
  if (!validatePlan(referenceScenario, reference).ok)
    throw Error("The starting plan is invalid.");
  const prior = assignments(reference),
    baseline = buildBaseline(s, reference, prior),
    recovery = checked(s, prior)!;
  const explanations: Explanation[] = s.pickups
    .filter((p) => !recovery.assignedIds.includes(p.id))
    .map((p) => {
      const alternative = checked(s, prior, p.id);
      if (!alternative)
        return {
          pickupId: p.id,
          kind: "infeasible",
          lossGrams: null,
          alternative: null,
          summary:
            "No available volunteer can include this pickup within the collection window, carrying limit, stop limit and return deadline.",
        };
      const lossGrams = recovery.scheduledGrams - alternative.scheduledGrams;
      return {
        pickupId: p.id,
        kind: lossGrams > 0 ? "tradeoff" : "tie",
        lossGrams,
        alternative,
        summary:
          lossGrams > 0
            ? "Including this pickup reduces the total scheduled weight."
            : "The same total is possible; keeping earlier assignments and reducing travel decide the route.",
      };
    });
  return {
    referencePlan: reference,
    baseline,
    recovery,
    explanations,
    elapsedMs: performance.now() - start,
  };
}
