import type {
  Scenario,
  Plan,
  Validation,
  PriorAssignments,
  FieldError,
} from "../domain/types.ts";
// Independently reconstruct the schedule; never accept solver totals as proof of feasibility.
export function validatePlan(
  s: Scenario,
  plan: Plan,
  prior: PriorAssignments = {},
): Validation<Plan> {
  const errors: FieldError[] = [];
  const fail = (message: string) => errors.push({ path: "plan", message });
  const assigned: string[] = [];
  let grams = 0,
    travel = 0,
    retained = 0;
  const seenCrew = new Set<string>();
  for (const r of plan.routes) {
    const v = s.volunteers.find((v) => v.id === r.volunteerId);
    if (!v || !v.available || seenCrew.has(r.volunteerId)) {
      fail("A route has unavailable, missing or repeated crew.");
      continue;
    }
    seenCrew.add(v.id);
    if (r.pickupIds.length > s.maxStops || !r.pickupIds.length)
      fail("A route has an invalid number of stops.");
    let at = "hub",
      time = v.startMinute,
      load = 0,
      minutes = 0,
      deadline = v.endMinute;
    if (r.stops.length !== r.pickupIds.length)
      fail("Stop details do not match the route.");
    r.pickupIds.forEach((id, i) => {
      const p = s.pickups.find((p) => p.id === id);
      if (!p) {
        fail("A pickup is missing.");
        return;
      }
      if (assigned.includes(id)) fail("A pickup is assigned more than once.");
      assigned.push(id);
      const leg = s.travelMinutes[at][id],
        arrival = time + leg,
        start = Math.max(arrival, p.readyMinute),
        depart = start + p.serviceMinutes;
      minutes += leg;
      load += p.weightGrams;
      deadline = Math.min(deadline, p.hubDeadlineMinute);
      if (depart > p.closeMinute || load > v.capacityGrams)
        fail("A collection exceeds its window or carrying limit.");
      const stop = r.stops[i];
      if (
        !stop ||
        stop.pickupId !== id ||
        stop.arrivalMinute !== arrival ||
        stop.collectionStartMinute !== start ||
        stop.departMinute !== depart ||
        stop.waitMinutes !== start - arrival ||
        stop.loadAfterGrams !== load ||
        stop.pickupSlackMinutes !== p.closeMinute - depart
      )
        fail("Stop timing or load is incorrect.");
      time = depart;
      at = id;
      if (prior[id] === v.id) retained++;
    });
    time += s.travelMinutes[at].hub;
    minutes += s.travelMinutes[at].hub;
    if (time > deadline) fail("A route returns after a hub deadline or shift.");
    if (
      r.returnMinute !== time ||
      r.weightGrams !== load ||
      r.travelMinutes !== minutes ||
      r.hubSlackMinutes !== deadline - time
    )
      fail("Route totals are incorrect.");
    grams += load;
    travel += minutes;
  }
  if (
    JSON.stringify([...assigned].sort()) !== JSON.stringify(plan.assignedIds) ||
    grams !== plan.scheduledGrams ||
    travel !== plan.travelMinutes ||
    retained !== plan.retainedCount
  )
    fail("Plan totals or assignment list are incorrect.");
  return errors.length ? { ok: false, errors } : { ok: true, value: plan };
}
