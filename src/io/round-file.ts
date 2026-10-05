import type { Scenario, Validation } from "../domain/types.ts";
import { validateScenario } from "../domain/scenario.ts";
export function parseRound(text: string): Validation<Scenario> {
  if (new TextEncoder().encode(text).length > 256 * 1024)
    return {
      ok: false,
      errors: [{ path: "file", message: "Choose a file smaller than 256 KB." }],
    };
  try {
    return validateScenario(JSON.parse(text));
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
