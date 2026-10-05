import type { Scenario, Calculation } from "../domain/types.ts";
import { createReport } from "./report.ts";
import { downloadJson } from "./round-file.ts";
type Kind = "report" | "round";
interface CurrentPlan {
  scenario: Scenario;
  referenceScenario: Scenario;
  calculation: Calculation;
}
const element = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;
export class PlanDelivery {
  private current: () => CurrentPlan | null;
  constructor(current: () => CurrentPlan | null) {
    this.current = current;
    element("copy-export").onclick = () => void this.copy();
    element("save-round").onclick = () => this.download("round");
    element("close-export").onclick = () => {
      this.clear();
      element("show-export")?.focus();
    };
  }
  clear(): void {
    element("export-panel").hidden = true;
    element<HTMLTextAreaElement>("export-text").value = "";
  }
  show(kind: Kind = "report"): unknown | null {
    const current = this.current();
    if (!current) return null;
    const value =
      kind === "report"
        ? createReport(
            current.referenceScenario,
            current.scenario,
            current.calculation,
          )
        : current.scenario;
    element<HTMLTextAreaElement>("export-text").value =
      JSON.stringify(value, null, 2) + "\n";
    element("export-label").textContent =
      `${kind === "report" ? "Plan report" : "Current round"} JSON — select to copy manually`;
    element("export-title").textContent =
      kind === "report" ? "Save this plan" : "Save the current round";
    element("export-feedback").textContent =
      "Ready to copy. Keep a saved file before reloading this page.";
    element("export-panel").hidden = false;
    return value;
  }
  download(kind: Kind = "report"): void {
    const value = this.show(kind);
    if (!value) return;
    try {
      downloadJson(
        value,
        kind === "report" ? "breadrelay-plan.json" : "breadrelay-round.json",
      );
      element("export-feedback").textContent =
        "Download requested. If it did not save, copy the JSON below.";
    } catch {
      element("export-feedback").textContent =
        "The download could not start. Copy the JSON below to save it manually.";
      element("export-panel").focus();
    }
  }
  private async copy(): Promise<void> {
    const field = element<HTMLTextAreaElement>("export-text"),
      text = field.value;
    if (!this.current() || !text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (field.value === text)
        element("export-feedback").textContent =
          "JSON copied to the clipboard.";
    } catch {
      if (field.value !== text) return;
      field.focus();
      field.select();
      element("export-feedback").textContent =
        "Clipboard access is unavailable. The JSON is selected; use your device’s Copy command.";
    }
  }
}
