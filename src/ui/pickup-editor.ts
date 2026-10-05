import type { Scenario, Pickup, FieldError } from "../domain/types.ts";
import { esc, time } from "./routes.ts";
const drafts = new Map<string, Record<string, string>>();
const errors = new Map<string, FieldError[]>();
export function clearPickupDrafts(): void {
  drafts.clear();
  errors.clear();
}
export function pickupEditorHtml(p: Pickup, open: string[]): string {
  const draft = drafts.get(p.id);
  const value = (field: string, original: string | number) =>
    esc(draft?.[field] ?? original);
  return `<details class="pickup-editor" id="pickup-limits-${p.id}" ${open.includes("pickup-limits-" + p.id) ? "open" : ""}>
  <summary>Edit offer <span class="sr-only">from ${esc(p.label)}</span></summary>
  <form data-pickup="${p.id}" novalidate>
    <div class="pickup-fields">
      <div><label for="weight-${p.id}">Expected weight (kg)</label><input id="weight-${p.id}" name="weight" type="number" min="0.001" max="100" step="0.001" value="${value("weight", p.weightGrams / 1000)}" inputmode="decimal" required></div>
      <div><label for="service-${p.id}">Collection time (min)</label><input id="service-${p.id}" name="service" type="number" min="0" max="120" step="1" value="${value("service", p.serviceMinutes)}" inputmode="numeric" required></div>
      <div><label for="ready-${p.id}">Ready from</label><input id="ready-${p.id}" name="ready" type="time" value="${value("ready", time(p.readyMinute))}" required></div>
      <div><label for="close-${p.id}">Finish pickup by</label><input id="close-${p.id}" name="close" type="time" value="${value("close", time(p.closeMinute))}" required></div>
      <div><label for="deadline-${p.id}">Back at hub by</label><input id="deadline-${p.id}" name="deadline" type="time" value="${value("deadline", time(p.hubDeadlineMinute))}" required></div>
    </div>
    <p class="field-hint">Hong Kong time, on this round’s date. Expected weight is not a delivery record.</p>
    <p class="draft-note" ${draft ? "" : "hidden"}>Changes aren’t applied to routes yet.</p>
    <button id="apply-pickup-${p.id}" type="submit" class="apply">Apply offer</button>
  </form></details>`;
}
export function bindPickupEditors(
  s: Scenario,
  hooks: {
    apply: (pickup: Pickup) => void;
    markErrors: (form: HTMLFormElement, errors: FieldError[]) => void;
    showErrors: (title: string, errors: FieldError[]) => void;
  },
): void {
  document
    .querySelectorAll<HTMLFormElement>("[data-pickup]")
    .forEach((form) => {
      const id = form.dataset.pickup!;
      const read = () =>
        Object.fromEntries(
          [...new FormData(form)].map(([key, value]) => [key, String(value)]),
        );
      hooks.markErrors(form, errors.get(id) ?? []);
      form.oninput = () => {
        drafts.set(id, read());
        form.querySelector<HTMLElement>(".draft-note")!.hidden = false;
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        const fields = read();
        const issues: FieldError[] = [];
        const issue = (field: string, message: string) =>
          issues.push({ path: field + "-" + id, message });
        const weight = Number(fields.weight),
          grams = Math.round(weight * 1000);
        const service = Number(fields.service);
        const readTime = (field: string): number => {
          if (!/^\d{2}:\d{2}$/.test(fields[field])) return NaN;
          const [hours, minutes] = fields[field].split(":").map(Number);
          return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : NaN;
        };
        const ready = readTime("ready"),
          close = readTime("close"),
          deadline = readTime("deadline");
        if (
          !fields.weight.trim() ||
          !Number.isFinite(weight) ||
          grams < 1 ||
          grams > 100000 ||
          Math.abs(weight * 1000 - grams) > 1e-7
        )
          issue(
            "weight",
            "Enter an expected weight from 0.001 to 100 kg, with at most three decimal places.",
          );
        if (
          !fields.service.trim() ||
          !Number.isInteger(service) ||
          service < 0 ||
          service > 120
        )
          issue(
            "service",
            "Enter a whole collection time from 0 to 120 minutes.",
          );
        if (!Number.isInteger(ready))
          issue("ready", "Enter a ready time on this day.");
        if (!Number.isInteger(close) || close < ready + service)
          issue(
            "close",
            "Allow enough time to finish collection after the ready time, on the same day.",
          );
        if (!Number.isInteger(deadline))
          issue("deadline", "Enter a hub deadline on this day.");
        hooks.markErrors(form, issues);
        if (issues.length) {
          drafts.set(id, fields);
          errors.set(id, issues);
          hooks.showErrors("The pickup offer needs a correction.", issues);
          return;
        }
        drafts.delete(id);
        errors.delete(id);
        hooks.apply({
          ...s.pickups.find((p) => p.id === id)!,
          weightGrams: grams,
          readyMinute: ready,
          closeMinute: close,
          serviceMinutes: service,
          hubDeadlineMinute: deadline,
        });
      };
    });
}
