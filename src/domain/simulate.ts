import type { Scenario, Volunteer, Route, Stop } from "./types.ts";
export function simulateRoute(
  s: Scenario,
  v: Volunteer,
  pickupIds: string[],
): Route | null {
  if (
    !v.available ||
    pickupIds.length > s.maxStops ||
    new Set(pickupIds).size !== pickupIds.length
  )
    return null;
  let clock = v.startMinute,
    location = "hub",
    load = 0,
    travel = 0;
  const stops: Stop[] = [];
  for (const id of pickupIds) {
    const pickup = s.pickups.find((p) => p.id === id);
    if (!pickup) return null;
    const leg = s.travelMinutes[location][id];
    const arrival = clock + leg;
    const start = Math.max(arrival, pickup.readyMinute);
    clock = start + pickup.serviceMinutes;
    load += pickup.weightGrams;
    travel += leg;
    if (clock > pickup.closeMinute || load > v.capacityGrams) return null;
    stops.push({
      pickupId: id,
      arrivalMinute: arrival,
      waitMinutes: start - arrival,
      collectionStartMinute: start,
      departMinute: clock,
      loadAfterGrams: load,
      pickupSlackMinutes: pickup.closeMinute - clock,
    });
    location = id;
  }
  const home = s.travelMinutes[location].hub;
  clock += home;
  travel += home;
  const deadline = Math.min(
    v.endMinute,
    ...pickupIds.map(
      (id) => s.pickups.find((p) => p.id === id)!.hubDeadlineMinute,
    ),
  );
  if (clock > deadline) return null;
  return {
    volunteerId: v.id,
    pickupIds: [...pickupIds],
    stops,
    returnMinute: clock,
    weightGrams: load,
    travelMinutes: travel,
    hubSlackMinutes: deadline - clock,
  };
}
