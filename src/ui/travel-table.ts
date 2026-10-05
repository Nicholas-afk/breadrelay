import type { Scenario } from "../domain/types.ts";
import { esc } from "./routes.ts";
export function travelTableHtml(s: Scenario): string {
  const locations = [s.hub, ...s.pickups];
  return `<table><caption>Entered travel minutes · ${esc(s.serviceDate)}</caption><thead><tr><th scope="col">From ↓ / to →</th>${locations.map((p) => `<th scope="col">${esc(p.label)}</th>`).join("")}</tr></thead><tbody>${locations.map((from) => `<tr><th scope="row">${esc(from.label)}</th>${locations.map((to) => `<td>${s.travelMinutes[from.id][to.id]}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
