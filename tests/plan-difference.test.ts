import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Scenario } from "../src/domain/types.ts";
import { calculate, assignments } from "../src/planner/calculate.ts";
import { solve } from "../src/planner/solve.ts";
import { validatePlan } from "../src/planner/validate-plan.ts";
import { planDifferenceHtml } from "../src/ui/routes.ts";

test("comparison distinguishes volunteer changes from pickup changes and safely renders imported labels", () => {
  const s = JSON.parse(
    readFileSync(new URL("../src/fixtures/demo.json", import.meta.url), "utf8"),
  ) as Scenario;
  s.pickups.find((p) => p.id === "bakery-f")!.label = "<b>Bakery F</b>";
  const selected = calculate(s, s, null).recovery;
  const swapped = Object.fromEntries(
    Object.entries(assignments(selected)).map(([id, crew]) => [
      id,
      crew === "volunteer-a" ? "volunteer-b" : "volunteer-a",
    ]),
  );
  const alternate = solve(s, swapped);
  assert.ok(alternate.ok);
  assert.ok(validatePlan(s, alternate.plan, swapped).ok);
  assert.equal(alternate.plan.scheduledGrams, selected.scheduledGrams);
  const html = planDifferenceHtml(s, selected, alternate.plan);
  assert.match(html, /Would change volunteer/);
  assert.match(html, /Volunteer A → Volunteer B/);
  assert.match(html, /Volunteer B → Volunteer A/);
  assert.match(html, /Would collect<\/dt><dd>None/);
  assert.match(html, /Would leave out<\/dt><dd>None/);
  assert.match(html, /&lt;b&gt;Bakery F&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>/);
});
