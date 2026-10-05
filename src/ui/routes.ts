import type { Scenario, Plan, Route } from "../domain/types.ts";
export const esc = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const kg = (grams: number): string =>
  new Intl.NumberFormat("en-HK", { maximumFractionDigits: 3 }).format(
    grams / 1000,
  );
export const time = (minute: number): string =>
  `${Math.floor(minute / 60)
    .toString()
    .padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
export function routeHtml(
  s: Scenario,
  r: Route,
  reference: Plan | null,
  alternative = false,
): string {
  const v = s.volunteers.find((v) => v.id === r.volunteerId)!;
  return `<article class="route">
<div class="route-heading">
<h3>${esc(v.label)}</h3>
<strong>${kg(r.weightGrams)} <span>kg</span>
</strong>
</div>
<p class="route-meta">${r.pickupIds.length} pickups · ${r.travelMinutes} min travel</p>
<ol class="stops">
<li class="hub-stop">
<time>${time(v.startMinute)}</time>
<div>
<strong>Leave ${esc(s.hub.label)}</strong>
</div>
</li>${r.stops
    .map((stop) => {
      const pickup = s.pickups.find((p) => p.id === stop.pickupId)!;
      const old = reference?.routes.find((route) =>
        route.pickupIds.includes(pickup.id),
      );
      const changed = old && old.volunteerId !== r.volunteerId;
      return `<li>
<time>${time(stop.collectionStartMinute)}</time>
<div>
<strong>${esc(pickup.label)}</strong>
<span class="stop-weight">${kg(pickup.weightGrams)} kg</span>
<p>Arrive ${time(stop.arrivalMinute)}${stop.waitMinutes ? ` · wait ${stop.waitMinutes} min` : ""} · collect ${pickup.serviceMinutes} min</p>
<p>Leave ${time(stop.departMinute)} · ${kg(stop.loadAfterGrams)} kg load</p>
<p>Closes ${time(pickup.closeMinute)} · ${stop.pickupSlackMinutes} min spare</p>${changed && !alternative ? '<span class="reassigned">Reassigned to this volunteer</span>' : ""}</div>
</li>`;
    })
    .join("")}<li class="hub-stop">
<time>${time(r.returnMinute)}</time>
<div>
<strong>Back at ${esc(s.hub.label)}</strong>
<p>${r.hubSlackMinutes} min before earliest return limit</p>
</div>
</li>
</ol>
</article>`;
}
export function planHtml(
  s: Scenario,
  p: Plan,
  reference: Plan | null,
  alternative = false,
): string {
  return p.routes.length
    ? `<div class="route-grid">${p.routes.map((r) => routeHtml(s, r, reference, alternative)).join("")}</div>`
    : `<div class="empty-routes">
<h3>${s.pickups.length ? "No pickups fit this crew." : "No pickups in this round."}</h3>
<p>${!s.pickups.length ? "Open a round file containing the bread offers to check collection routes." : s.volunteers.some((v) => v.available) ? "Check carrying limits and collection times, or add an available volunteer in your round file." : "Restore a volunteer below Who’s collecting to check the round again."}</p>
</div>`;
}
