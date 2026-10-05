import { chromium } from "playwright";
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./serve-static.mjs";
const output = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
await mkdir(output, { recursive: true });
const names = await readdir(new URL("../dist/assets/", import.meta.url));
const workerName = names.find(
  (n) => n.startsWith("worker-") && n.endsWith(".js"),
);
const nodes = ["hub", ...Array.from({ length: 10 }, (_, i) => "pickup-" + i)];
const scenario = {
  schemaVersion: 1,
  title: "Permissive stress round",
  serviceDate: "2026-10-06",
  timezone: "Asia/Hong_Kong",
  dataKind: "synthetic",
  travelSource:
    "All distinct locations 2 minutes apart; synthetic stress only.",
  hub: { id: "hub", label: "Hub" },
  maxStops: 3,
  pickups: nodes
    .slice(1)
    .map((id, i) => ({
      id,
      label: id,
      weightGrams: (i + 1) * 1000,
      readyMinute: 0,
      closeMinute: 1439,
      serviceMinutes: 3,
      hubDeadlineMinute: 1439,
    })),
  volunteers: Array.from({ length: 3 }, (_, i) => ({
    id: "volunteer-" + i,
    label: "Crew " + i,
    capacityGrams: 200000,
    startMinute: 0,
    endMinute: 1439,
    available: true,
  })),
  travelMinutes: Object.fromEntries(
    nodes.map((a) => [
      a,
      Object.fromEntries(nodes.map((b) => [b, a === b ? 0 : 2])),
    ]),
  ),
};
const server = await serve(0),
  port = server.address().port;
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "darwin"
    ? {
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      }
    : {}),
});
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/breadrelay/`);
  const times = await page.evaluate(
    async ({ scenario, workerName }) => {
      const worker = new Worker(
          new URL("assets/" + workerName, location.href),
          { type: "module" },
        ),
        times = [];
      for (let id = 1; id <= 30; id++) {
        const response = await new Promise((done, fail) => {
          worker.onmessage = (e) => done(e.data);
          worker.onerror = fail;
          worker.postMessage({
            id,
            scenario,
            referenceScenario: scenario,
            referencePlan: null,
          });
        });
        if (!response.ok) throw Error(response.message);
        times.push(response.value.elapsedMs);
        if (response.value.recovery.scheduledGrams !== 54000)
          throw Error("Incorrect stress fixture result");
      }
      worker.terminate();
      return times;
    },
    { scenario, workerName },
  );
  const sorted = [...times].sort((a, b) => a - b);
  const report = {
    kind: "Synthetic compiled-worker benchmark",
    browser: browser.version(),
    pickups: 10,
    volunteers: 3,
    maxStops: 3,
    iterations: 30,
    measurement:
      "Full reference + baseline + recovery + all excluded-pickup explanations and independent validation, inside one loaded worker",
    medianMs: sorted[15],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1),
    allMs: times,
    scheduledGrams: 54000,
    limits:
      "This machine and synthetic input only; not a field or all-device guarantee.",
  };
  await writeFile(
    resolve(output, "IMPLEMENTATION_BENCHMARK.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify({ ...report, allMs: undefined }, null, 2));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
