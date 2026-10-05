import type { Scenario, Validation } from "../domain/types.ts";
import { validateScenario } from "../domain/scenario.ts";
export interface OpenedRound {
  referenceScenario: Scenario;
  currentScenario: Scenario;
  restoredReport: boolean;
}
export function parseRound(text: string): Validation<OpenedRound> {
  if (new TextEncoder().encode(text).length > 256 * 1024)
    return {
      ok: false,
      errors: [{ path: "file", message: "Choose a file smaller than 256 KB." }],
    };
  try {
    const input: unknown = JSON.parse(text);
    if (
      input &&
      typeof input === "object" &&
      "kind" in input &&
      input.kind === "breadrelay-report"
    ) {
      const report = input as Record<string, unknown>;
      if (report.version !== 1)
        return {
          ok: false,
          errors: [
            {
              path: "file",
              message:
                "This report version is not supported. Use a version 1 report.",
            },
          ],
        };
      const reference = validateScenario(report.referenceScenario);
      const current = validateScenario(report.currentScenario);
      if (!reference.ok)
        return {
          ok: false,
          errors: reference.errors.map((e) => ({
            ...e,
            path: "referenceScenario." + e.path,
          })),
        };
      if (!current.ok)
        return {
          ok: false,
          errors: current.errors.map((e) => ({
            ...e,
            path: "currentScenario." + e.path,
          })),
        };
      const ids = (items: { id: string }[]) =>
        items
          .map((x) => x.id)
          .sort()
          .join("|");
      if (
        reference.value.serviceDate !== current.value.serviceDate ||
        ids(reference.value.pickups) !== ids(current.value.pickups) ||
        ids(reference.value.volunteers) !== ids(current.value.volunteers)
      )
        return {
          ok: false,
          errors: [
            {
              path: "file",
              message:
                "The report must compare the same date, pickup IDs and volunteer IDs. Open a round file to replace locations or crew.",
            },
          ],
        };
      // Only validated inputs enter the application. Imported totals and routes are never trusted.
      return {
        ok: true,
        value: {
          referenceScenario: reference.value,
          currentScenario: current.value,
          restoredReport: true,
        },
      };
    }
    const round = validateScenario(input);
    return round.ok
      ? {
          ok: true,
          value: {
            referenceScenario: structuredClone(round.value),
            currentScenario: round.value,
            restoredReport: false,
          },
        }
      : round;
  } catch {
    return {
      ok: false,
      errors: [
        {
          path: "file",
          message:
            "Choose a valid JSON round file. The current round has not changed.",
        },
      ],
    };
  }
}
export function downloadJson(value: unknown, name: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
