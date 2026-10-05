import "../ui/styles.css";
import "../io/print.css";
import rawDemo from "../fixtures/demo.json";
import type {
  Scenario,
  Plan,
  Calculation,
  FieldError,
} from "../domain/types.ts";
import { validateScenario } from "../domain/scenario.ts";
import { parseRound, downloadJson } from "../io/round-file.ts";
import { PlanDelivery } from "../io/plan-delivery.ts";
import { WorkerClient } from "./worker-client.ts";
import { esc, kg, time, planHtml } from "../ui/routes.ts";
import {
  pickupEditorHtml,
  bindPickupEditors,
  clearPickupDrafts,
} from "../ui/pickup-editor.ts";
import { travelTableHtml } from "../ui/travel-table.ts";
const checked = validateScenario(rawDemo);
if (!checked.ok) throw Error("Bundled sample is invalid.");
const demo = checked.value;
let scenario = structuredClone(demo),
  referenceScenario = structuredClone(demo),
  lastCheckedScenario: Scenario | null = null,
  referencePlan: Plan | null = null,
  calculation: Calculation | null = null;
let fileRevision = 0;
const drafts = new Map<
  string,
  { capacity: string; start: string; end: string }
>();
const draftErrors = new Map<string, FieldError[]>();
let revision = 0,
  phase: "pending" | "ready" | "error" = "pending",
  errorMessage = "",
  activeExplanation: string | null = null;
const worker = new WorkerClient();
const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
const announce = (text: string) => {
  $("announcer").textContent = text;
};
const delivery = new PlanDelivery(() =>
  phase === "ready" && calculation
    ? { scenario, referenceScenario, calculation }
    : null,
);
function clearErrors(): void {
  $("error-box").hidden = true;
  document.title = "BreadRelay — evening collection planner";
}
function showErrors(title: string, errors: FieldError[]): void {
  const box = $("error-box");
  const shown = errors.slice(0, 12);
  box.innerHTML = `<h2 id="error-title">${esc(title)}</h2>
<p>Your last applied round is unchanged.</p>
${errors.length > shown.length ? `<p>Showing the first ${shown.length} of ${errors.length} corrections. Fix these, then open the file again.</p>` : ""}
<ul>${shown
    .map(
      (e) => `<li>
<a href="#${e.path === "file" ? "import" : esc(e.path)}">${esc(e.message)}</a>
</li>`,
    )
    .join("")}</ul>`;
  box.hidden = false;
  box.focus();
  document.title = "Error: BreadRelay — collection planner";
  box.querySelectorAll<HTMLAnchorElement>("a").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        const target = document.getElementById(a.hash.slice(1));
        target?.closest("details")?.setAttribute("open", "");
        target?.focus();
      }),
  );
}
function markFieldErrors(form: HTMLFormElement, errors: FieldError[]): void {
  form.querySelectorAll("[aria-invalid]").forEach((el) => {
    el.removeAttribute("aria-invalid");
    el.removeAttribute("aria-errormessage");
  });
  form.querySelectorAll(".field-error").forEach((el) => el.remove());
  for (const error of errors) {
    const field = $(error.path);
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-errormessage", "error-" + error.path);
    const note = document.createElement("span");
    note.className = "field-error";
    note.id = "error-" + error.path;
    note.textContent = error.message;
    field.after(note);
  }
}
function changed(): boolean {
  return JSON.stringify(scenario) !== JSON.stringify(referenceScenario);
}
function render(): void {
  const focus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.id
      : "";
  const open = [
    ...document.querySelectorAll<HTMLDetailsElement>(
      "#crew details[open], #offers details[open]",
    ),
  ].map((d) => d.id);
  $("date-label").textContent =
    `/ ${new Intl.DateTimeFormat("en-HK", { day: "numeric", month: "short", timeZone: "Asia/Hong_Kong" }).format(new Date(scenario.serviceDate + "T12:00:00+08:00"))}`;
  $("data-note").innerHTML =
    scenario.dataKind === "synthetic"
      ? `<strong>Sample round.</strong> Fictional bakeries, volunteers and travel times. ${scenario.volunteers.find((v) => v.id === "volunteer-a")?.available ? "Try marking Volunteer A unavailable." : "Change the crew or offers to test replanning."}`
      : "<strong>Your round.</strong> Supplied weights and travel minutes; no live traffic checks.";
  $("travel-source").textContent = scenario.travelSource;
  $("travel-table").innerHTML = travelTableHtml(scenario);
  $("print-context").innerHTML = `<h1>BreadRelay collection plan</h1>
<p>${esc(scenario.serviceDate)} · Hong Kong time (Asia/Hong_Kong)</p>
<p>${scenario.dataKind === "synthetic" ? "Sample round — synthetic bakeries, volunteers and times." : "Operator-supplied round."} Scheduled quantities; delivery is not verified.</p>
<p>${esc(scenario.travelSource)}</p>`;
  const available = scenario.volunteers.filter((v) => v.available).length;
  $("crew-count").textContent = `${available} available`;
  $("crew").innerHTML = scenario.volunteers
    .map((v) => {
      const draft = drafts.get(v.id);
      return `<div class="crew-row ${v.available ? "" : "unavailable"}">
<div class="crew-top">
<div>
<h3>${esc(v.label)}</h3>
<p>${v.available ? `${kg(v.capacityGrams)} kg limit · ${time(v.startMinute)}–${time(v.endMinute)}` : "Unavailable for this round"}</p>
</div>
<button class="availability ${v.available ? "" : "restore"}" id="toggle-${v.id}" data-toggle="${esc(v.id)}" aria-label="${v.available ? "Mark" : "Restore"} ${esc(v.label)}${v.available ? " unavailable" : ""}">${v.available ? "Mark unavailable" : "Restore volunteer"}</button>
</div>
<details id="limits-${v.id}" ${open.includes("limits-" + v.id) ? "open" : ""}>
<summary>Change carrying limit or shift</summary>
<form data-volunteer="${esc(v.id)}" novalidate>
<label for="capacity-${v.id}">Carrying limit (kg)</label>
<input id="capacity-${v.id}" name="capacity" type="number" min="0" max="200" step="0.001" inputmode="decimal" value="${esc(draft?.capacity ?? String(v.capacityGrams / 1000))}" required aria-describedby="capacity-help-${v.id}">
<span id="capacity-help-${v.id}" class="field-hint">0–200 kg; keep to what they can carry.</span>
<div class="time-fields">
<div>
<label for="start-${v.id}">Leave hub</label>
<input id="start-${v.id}" name="start" type="time" value="${esc(draft?.start ?? time(v.startMinute))}" required>
</div>
<div>
<label for="end-${v.id}">Return by</label>
<input id="end-${v.id}" name="end" type="time" value="${esc(draft?.end ?? time(v.endMinute))}" required>
</div>
</div>
<p class="draft-note" ${draft ? "" : "hidden"}>Changes aren’t applied to routes yet.</p>
<button type="submit" id="apply-${v.id}" class="apply">Apply limits</button>
</form>
</details>
</div>`;
    })
    .join("");
  document.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach(
    (b) =>
      (b.onclick = () => {
        const v = scenario.volunteers.find((v) => v.id === b.dataset.toggle)!;
        v.available = !v.available;
        activeExplanation = null;
        clearErrors();
        recalculate();
      }),
  );
  document
    .querySelectorAll<HTMLFormElement>("[data-volunteer]")
    .forEach((form) => {
      const volunteerId = form.dataset.volunteer!;
      markFieldErrors(form, draftErrors.get(volunteerId) ?? []);
      form.oninput = () => {
        const data = new FormData(form);
        drafts.set(volunteerId, {
          capacity: String(data.get("capacity")),
          start: String(data.get("start")),
          end: String(data.get("end")),
        });
        form.querySelector<HTMLElement>(".draft-note")!.hidden = false;
      };
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = scenario.volunteers.find(
            (v) => v.id === form.dataset.volunteer,
          )!,
          data = new FormData(form),
          errors: FieldError[] = [];
        const capacity = Number(data.get("capacity")),
          grams = Math.round(capacity * 1000);
        const readTime = (name: string): number => {
          const value = String(data.get(name));
          if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
          const [h, m] = value.split(":").map(Number);
          return h * 60 + m;
        };
        const start = readTime("start"),
          end = readTime("end");
        if (
          String(data.get("capacity")).trim() === "" ||
          !Number.isFinite(capacity) ||
          capacity < 0 ||
          capacity > 200 ||
          Math.abs(capacity * 1000 - grams) > 1e-7
        )
          errors.push({
            path: "capacity-" + v.id,
            message:
              "Enter a carrying limit from 0 to 200 kg, with at most three decimal places.",
          });
        if (!Number.isInteger(start) || start < 0 || start > 1439)
          errors.push({
            path: "start-" + v.id,
            message: "Enter a departure time on this day.",
          });
        if (!Number.isInteger(end) || end < 0 || end > 1439 || end < start)
          errors.push({
            path: "end-" + v.id,
            message: "Enter a return time after departure, on the same day.",
          });
        markFieldErrors(form, errors);
        if (errors.length) {
          draftErrors.set(v.id, errors);
          showErrors("The crew limits need a correction.", errors);
          return;
        }
        drafts.delete(v.id);
        draftErrors.delete(v.id);
        Object.assign(v, {
          capacityGrams: grams,
          startMinute: start,
          endMinute: end,
        });
        activeExplanation = null;
        clearErrors();
        recalculate();
      };
    });
  const p = calculation?.recovery,
    baseline = calculation?.baseline.plan;
  const gain = p && baseline ? p.scheduledGrams - baseline.scheduledGrams : 0;
  const current = phase === "ready";
  $("result-band").setAttribute("aria-busy", String(phase === "pending"));
  $("result-band").classList.toggle("is-error", phase === "error");
  $("result-band").innerHTML = `<div class="result-main">
<p class="eyebrow">${phase === "pending" ? "CHECKING THE ROUND" : phase === "error" ? "LAST VALID RESULT" : changed() ? "REVISED COLLECTION PLAN" : "STARTING COLLECTION PLAN"}</p>
<h2 id="result-title">${p ? kg(p.scheduledGrams) : "—"}<span> kg ${current ? "scheduled" : "last checked"}</span>
</h2>
<p>${phase === "pending" ? "Checking collection windows, carrying limits and return times…" : phase === "error" ? esc(errorMessage) : !available ? "No volunteers available. Restore a volunteer to plan pickups." : gain > 0 ? `<strong>${kg(gain)} kg more</strong> than keeping the unchanged routes.` : changed() ? "No extra weight fits beyond the unchanged routes." : "Change the crew below to see what can be reassigned."}</p>
</div>
<div class="result-side">${
    p && baseline && changed() && current
      ? `<p class="comparison">
<span>${kg(baseline.scheduledGrams)} kg<small>unchanged routes</small>
</span>
<span class="arrow" aria-hidden="true">→</span>
<span>${kg(p.scheduledGrams)} kg<small>revised plan</small>
</span>
</p>
<p class="reference">Starting plan: ${kg(calculation!.referencePlan.scheduledGrams)} kg · ${p.retainedCount} earlier assignments kept</p>`
      : p && !current
        ? `<p class="round-total">Showing the last checked plan</p>
<p class="reference">The current round changes have not been verified.</p>`
        : `<p class="round-total">${scenario.pickups.length} pickups offered · ${kg(scenario.pickups.reduce((n, p) => n + p.weightGrams, 0))} kg total</p>
<p class="reference">${esc(scenario.title)} · ${scenario.volunteers.length ? time(Math.min(...scenario.volunteers.map((v) => v.startMinute))) + " onwards" : "no crew entered"}</p>`
  }${current && changed() && calculation?.baseline.droppedRoutes.length ? `<details id="baseline-details" class="baseline-details"><summary>${calculation.baseline.droppedRoutes.length} starting route(s) removed from the unchanged plan</summary><ul>${calculation.baseline.droppedRoutes.map((route) => `<li>${esc(referenceScenario.volunteers.find((v) => v.id === route.volunteerId)?.label ?? route.volunteerId)}: ${esc(route.reason)}</li>`).join("")}</ul></details>` : ""}<div class="export-actions">
<button id="export" class="primary" ${current ? "" : "disabled"}>Download plan <span aria-hidden="true">↓</span>
</button>
<button id="print" class="on-dark" ${current ? "" : "disabled"}>Print routes</button><button id="show-export" class="on-dark" ${current ? "" : "disabled"}>Copy or save</button>${phase === "error" ? '<button id="retry" class="on-dark">Retry</button>' : ""}</div>
</div>`;
  if (phase === "ready") {
    $<HTMLButtonElement>("export").onclick = () => {
      if (phase !== "ready" || !calculation) return;
      delivery.download();
    };
    $<HTMLButtonElement>("print").onclick = () => window.print();
    $("show-export").onclick = () => {
      delivery.show();
      $("export-panel").focus();
    };
  }
  if (phase === "error") $("retry").onclick = () => recalculate();
  $("route-state").textContent =
    phase === "pending"
      ? "Updating…"
      : phase === "error"
        ? "Stale — retry needed"
        : p
          ? `${p.assignedIds.length} of ${scenario.pickups.length} pickups scheduled`
          : "";
  $("routes").classList.toggle("stale", !current);
  $("routes").innerHTML = p
    ? planHtml(lastCheckedScenario ?? scenario, p, referencePlan)
    : '<div class="empty-routes"><h3>Checking your first routes…</h3><p>Each volunteer’s timing and carrying limits are being checked.</p></div>';
  const unassigned = scenario.pickups.filter(
    (pickup) => !p?.assignedIds.includes(pickup.id),
  );
  $("unassigned-note").hidden = !current || !unassigned.length;
  if (current && unassigned.length)
    $("unassigned-note").innerHTML =
      `${kg(unassigned.reduce((n, pickup) => n + pickup.weightGrams, 0))} kg across ${unassigned.length} pickups is not scheduled. <a id="review-unassigned" href="#why-${unassigned[0].id}">Review the trade-offs</a>.`;
  $("offer-count").textContent = current
    ? `${scenario.pickups.length} pickups`
    : "Current inputs";
  $("offers").innerHTML =
    scenario.pickups
      .map((pickup) => {
        const route = p?.routes.find((r) => r.pickupIds.includes(pickup.id));
        return `<li class="offer-row">
<div class="offer-name">
<strong>${esc(pickup.label)}</strong>
<span>${kg(pickup.weightGrams)} kg</span>
</div>
<div class="offer-window">
<span class="mobile-label">Collect</span>${time(pickup.readyMinute)}–${time(pickup.closeMinute)}</div>
<div class="offer-deadline">
<span class="mobile-label">Hub by</span>${time(pickup.hubDeadlineMinute)}</div>
<div class="offer-assignment">${
          !current
            ? `<span class="not-checked">${phase === "pending" ? "Checking…" : "Not checked"}</span>`
            : route
              ? `<span>${esc(scenario.volunteers.find((v) => v.id === route.volunteerId)!.label)}</span>`
              : `<span class="not-assigned">Not assigned</span>
<button class="text-button" id="why-${pickup.id}" data-explain="${esc(pickup.id)}" ${current ? "" : "disabled"} aria-expanded="${activeExplanation === pickup.id}">Why this pickup?</button>`
        }</div>
${pickupEditorHtml(pickup, open)}
</li>`;
      })
      .join("") ||
    '<li class="empty-offers">No pickups in this round. Open a round file with your collection offers.</li>';
  bindPickupEditors(scenario, {
    markErrors: markFieldErrors,
    showErrors,
    apply: (pickup) => {
      const candidate = structuredClone(scenario);
      candidate.pickups[
        candidate.pickups.findIndex((p) => p.id === pickup.id)
      ] = pickup;
      const valid = validateScenario(candidate);
      if (!valid.ok) {
        showErrors(
          "The offer could not be applied.",
          valid.errors.map((e) => ({ path: "file", message: e.message })),
        );
        return;
      }
      scenario = valid.value;
      activeExplanation = null;
      clearErrors();
      recalculate();
    },
  });
  document.querySelectorAll<HTMLButtonElement>("[data-explain]").forEach(
    (b) =>
      (b.onclick = () => {
        activeExplanation =
          activeExplanation === b.dataset.explain ? null : b.dataset.explain!;
        renderAlternative();
        document
          .querySelectorAll<HTMLButtonElement>("[data-explain]")
          .forEach((x) =>
            x.setAttribute(
              "aria-expanded",
              String(x.dataset.explain === activeExplanation),
            ),
          );
        if (activeExplanation) $("alternative").focus();
      }),
  );
  renderAlternative();
  if (focus && document.getElementById(focus))
    $(focus).focus({ preventScroll: true });
}
function renderAlternative(): void {
  const box = $("alternative"),
    ex = calculation?.explanations.find(
      (e) => e.pickupId === activeExplanation,
    );
  box.hidden = !ex || phase !== "ready";
  if (!ex) return;
  const pickup = scenario.pickups.find((p) => p.id === ex.pickupId)!;
  box.innerHTML = `<div class="alternative-heading">
<div>
<p class="eyebrow">CHECK THE TRADE-OFF</p>
<h2 id="alternative-title">Why isn’t ${esc(pickup.label)} assigned?</h2>
</div>
<button id="close-alternative" class="quiet" aria-label="Close pickup explanation">Close</button>
</div>${
    ex.alternative
      ? `<p class="tradeoff">
<strong>${kg(ex.alternative.scheduledGrams)} kg scheduled</strong> if ${esc(pickup.label)} is included${ex.lossGrams ? ` — ${kg(ex.lossGrams)} kg less than the revised plan.` : "."}</p>`
      : ""
  }<p>${esc(ex.summary)}</p>${ex.alternative ? planHtml(scenario, ex.alternative, referencePlan, true) : "<p>Check this pickup’s window and return deadline, or restore a volunteer. A spare vehicle or extra time is not assumed.</p>"}<p class="alternative-caption">This is an explanation; your selected plan has not changed.</p>`;
  $("close-alternative").onclick = () => {
    const previous = activeExplanation;
    activeExplanation = null;
    renderAlternative();
    document
      .querySelectorAll("[data-explain]")
      .forEach((x) => x.setAttribute("aria-expanded", "false"));
    if (previous) $("why-" + previous).focus();
  };
}
function recalculate(): void {
  delivery.clear();
  const id = ++revision;
  phase = "pending";
  errorMessage = "";
  render();
  announce("Checking revised collection routes.");
  worker.run(
    {
      id,
      scenario: structuredClone(scenario),
      referenceScenario,
      referencePlan,
    },
    (c) => {
      if (id !== revision) return;
      calculation = c;
      lastCheckedScenario = structuredClone(scenario);
      referencePlan = c.referencePlan;
      phase = "ready";
      render();
      announce(
        `${kg(c.recovery.scheduledGrams)} kilograms scheduled across ${c.recovery.routes.length} routes.`,
      );
    },
    (message) => {
      if (id !== revision) return;
      phase = "error";
      errorMessage = message;
      render();
      announce(message);
    },
  );
}
$("reset").onclick = () => {
  clearPickupDrafts();
  drafts.clear();
  draftErrors.clear();
  scenario = structuredClone(demo);
  referenceScenario = structuredClone(demo);
  referencePlan = null;
  calculation = null;
  lastCheckedScenario = null;
  activeExplanation = null;
  clearErrors();
  recalculate();
};
$("sample-file").onclick = () => {
  try {
    downloadJson(demo, "breadrelay-sample-round.json");
    clearErrors();
    announce("Sample file download requested.");
  } catch {
    showErrors("The sample download could not start.", [
      {
        path: "sample-file",
        message:
          "Retry the sample download when browser downloads are available. Your current plan is unchanged.",
      },
    ]);
  }
};
$("import").onclick = () => $<HTMLInputElement>("round-file").click();
$<HTMLInputElement>("round-file").onchange = async (e) => {
  const input = e.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const token = ++fileRevision,
    atRevision = revision;
  if (file.size > 256 * 1024) {
    showErrors("The round file could not be opened.", [
      {
        path: "file",
        message:
          "Choose a round JSON file smaller than 256 KB. The current round has not changed.",
      },
    ]);
    return;
  }
  try {
    const text = await file.text();
    if (token !== fileRevision || atRevision !== revision) return;
    const parsed = parseRound(text);
    if (!parsed.ok) {
      showErrors(
        "The round file could not be opened.",
        parsed.errors.map((e) => ({
          path: "file",
          message: `${e.path}: ${e.message}`,
        })),
      );
      return;
    }
    drafts.clear();
    draftErrors.clear();
    clearPickupDrafts();
    scenario = parsed.value.currentScenario;
    referenceScenario = parsed.value.referenceScenario;
    referencePlan = null;
    calculation = null;
    lastCheckedScenario = null;
    activeExplanation = null;
    clearErrors();
    recalculate();
  } catch {
    if (token !== fileRevision || atRevision !== revision) return;
    showErrors("The round file could not be read.", [
      {
        path: "file",
        message: "Choose the file again. The current round has not changed.",
      },
    ]);
  }
};
const mobile = matchMedia("(max-width:700px)");
function placeResult(): void {
  const band = $("result-band"),
    panel = $("export-panel"),
    workspace = document.querySelector(".workspace")!;
  if (mobile.matches) {
    workspace.insertBefore(band, document.querySelector(".route-section"));
    workspace.insertBefore(panel, document.querySelector(".route-section"));
  } else {
    $("main").insertBefore(band, workspace);
    $("main").insertBefore(panel, workspace);
  }
}
mobile.addEventListener("change", placeResult);
placeResult();
recalculate();
