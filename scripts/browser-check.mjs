import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { serve } from "./serve-static.mjs";
const artifacts = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
await mkdir(artifacts, { recursive: true });
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
const results = {
  browser: browser.version(),
  builtStaticSubpath: "/breadrelay/",
  viewports: [],
  checks: [],
  errors: [],
  externalRequests: [],
  screenshots: [],
  measurements: {},
};
const check = (name) => results.checks.push(name);
const demo = JSON.parse(
  await readFile(new URL("../src/fixtures/demo.json", import.meta.url), "utf8"),
);
let page;
const ready = async () => {
  await page.waitForFunction(
    () =>
      document.querySelector("#result-band")?.getAttribute("aria-busy") ===
        "false" &&
      !document
        .querySelector("#result-band")
        ?.textContent.includes("LAST VALID RESULT"),
  );
};
const screenshot = async (name, fullPage = true) => {
  await page.screenshot({
    path: resolve(artifacts, `breadrelay-${name}.png`),
    fullPage,
  });
  results.screenshots.push(`breadrelay-${name}.png`);
};
const upload = async (value) =>
  page.locator("#round-file").setInputFiles({
    name: "round.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  page.on("pageerror", (e) => results.errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith(`http://127.0.0.1:${port}/`) &&
      !r.url().startsWith("data:")
    )
      results.externalRequests.push(r.url());
  });
  page.on("response", (r) => {
    if (r.status() >= 400)
      results.errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);
  });
  await page.goto(`http://127.0.0.1:${port}/breadrelay/`);
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^38/);
  check("Automatic validated 38 kg starting plan");
  await screenshot("desktop-start");
  const started = Date.now();
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  results.measurements.demoClickToReadyMs = Date.now() - started;
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  assert.match(await page.locator(".comparison").innerText(), /18 kg/);
  assert.match(await page.locator(".result-main").innerText(), /8 kg more/);
  check(
    "Cancellation: 18 kg unchanged route -> 26 kg revised plan, 8 kg difference",
  );
  await screenshot("desktop");
  await page.locator("#why-bakery-c").click();
  assert.equal(await page.locator("#alternative").isVisible(), true);
  assert.match(
    await page.locator("#alternative").innerText(),
    /23 kg scheduled/,
  );
  assert.match(await page.locator("#alternative").innerText(), /3 kg less/);
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  check(
    "Forced inclusion shows genuine 23 kg alternative without changing selected plan",
  );
  await screenshot("explanation");
  await page.locator("#close-alternative").click();
  assert.equal(
    await page.locator("#why-bakery-c").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "why-bakery-c",
  );
  check("Explanation close restores keyboard focus and collapsed state");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#export").click(),
  ]);
  const report = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(report.recovery.scheduledGrams, 26000);
  assert.equal(report.baseline.plan.scheduledGrams, 18000);
  assert.equal(report.claims.actualDeliveryVerified, false);
  check(
    "Downloaded report contains current scenarios, routes, baseline and honest claims",
  );
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".crew-section").isVisible(), false);
  assert.equal(await page.locator("#routes").isVisible(), true);
  assert.match(await page.locator("#print-context").innerText(), /synthetic/);
  assert.match(await page.locator("#print-context").innerText(), /2026-10-06/);
  assert.match(await page.locator("#print-context").innerText(), /Hong Kong/);
  await page.pdf({
    path: resolve(artifacts, "breadrelay-print-routes.pdf"),
    format: "A4",
  });
  await screenshot("print");
  await page.emulateMedia({ media: "screen" });
  check("Printable route sheet excludes controls and preserves route times");
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert.equal(overflow, false);
    results.viewports.push({
      width,
      height: 844,
      horizontalOverflow: overflow,
    });
    if (width === 390) {
      await page.waitForFunction(() =>
        Boolean(
          document
            .querySelector("#crew")
            .compareDocumentPosition(document.querySelector("#export")) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      );
      assert.equal(
        await page.evaluate(() =>
          Boolean(
            document
              .querySelector("#crew")
              .compareDocumentPosition(document.querySelector("#export")) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        ),
        true,
      );
      check("Phone keyboard and DOM order put crew before plan export");
      await screenshot("mobile");
      await page.evaluate(() => window.scrollTo(0, 0));
      await screenshot("mobile-fold", false);
    }
    if (width === 320) await screenshot("mobile-320");
  }
  check("No horizontal page overflow at 320, 390 and 768 px");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#limits-volunteer-b summary").click();
  await page.locator("#capacity-volunteer-b").fill("-1");
  await page.locator("#apply-volunteer-b").click();
  assert.equal(await page.locator("#error-box").isVisible(), true);
  assert.equal(
    await page.locator("#capacity-volunteer-b").getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "error-box",
  );
  await page.locator("#error-box a").click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "capacity-volunteer-b",
  );
  await screenshot("field-error");
  check(
    "Invalid capacity keeps valid plan; linked error summary moves focus to field",
  );
  await page.locator("#capacity-volunteer-b").fill("31");
  await page.locator("#apply-volunteer-b").click();
  await ready();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "apply-volunteer-b",
  );
  assert.equal(await page.locator("#error-box").isVisible(), false);
  check("Correction applies successfully and keeps keyboard focus");
  await upload("{this is not JSON");
  assert.equal(await page.locator("#error-box").isVisible(), true);
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  await screenshot("import-error");
  check("Invalid file is rejected transactionally");
  await page.locator("#reset").click();
  await ready();
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  await page.locator("#toggle-volunteer-b").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^0/);
  assert.match(await page.locator("#routes").innerText(), /No pickups fit/);
  assert.equal(await page.locator(".not-assigned").count(), 6);
  await screenshot("empty");
  check(
    "No available volunteers -> 0 kg, no invented routes, six unassigned offers",
  );
  await page.locator("#why-bakery-a").click();
  assert.match(
    await page.locator("#alternative").innerText(),
    /No available volunteer can include/,
  );
  check("Impossible pickup gets an infeasibility explanation");
  const empty = structuredClone(demo);
  empty.pickups = [];
  empty.volunteers = [];
  empty.travelMinutes = { hub: { hub: 0 } };
  await upload(empty);
  await page.waitForFunction(() =>
    document.querySelector("#offers")?.textContent.includes("No pickups"),
  );
  await ready();
  assert.match(await page.locator("#offers").innerText(), /No pickups/);
  check("Empty imported round renders actionable empty offers");
  await page.locator("#reset").click();
  await ready();
  let delay = true;
  await page.route("**/assets/worker-*.js", async (route) => {
    if (delay) await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  await page.locator("#toggle-volunteer-a").click();
  assert.equal(await page.locator("#export").isDisabled(), true);
  assert.match(await page.locator("#result-title").innerText(), /last checked/);
  await screenshot("loading");
  await page.locator("#limits-volunteer-b summary").click();
  await page.locator("#capacity-volunteer-b").fill("25.123");
  await ready();
  assert.equal(
    await page.locator("#capacity-volunteer-b").inputValue(),
    "25.123",
  );
  check("Calculation completion preserves unfinished field drafts");
  delay = false;
  await page.unroute("**/assets/worker-*.js");
  check(
    "Real worker loading identifies last result and disables current export",
  );
  await page.route("**/assets/worker-*.js", async (route) => {
    await new Promise((r) => setTimeout(r, 180));
    await route.continue();
  });
  await page.locator("#toggle-volunteer-a").click();
  await page.locator("#reset").click();
  await ready();
  await page.waitForTimeout(350);
  assert.match(await page.locator("#result-title").innerText(), /^38/);
  await page.unroute("**/assets/worker-*.js");
  check(
    "Rapid change followed by reset cannot be overwritten by an old worker reply",
  );
  await page.route("**/assets/worker-*.js", (route) => route.abort("failed"));
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  await page.unroute("**/assets/worker-*.js");
  check(
    "Actual worker load failure uses bounded local fallback and preserves validated results",
  );
  await page.route("**/assets/worker-*.js", async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    try {
      await route.continue();
    } catch {}
  });
  await page.locator("#toggle-volunteer-b").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#result-band")
      ?.textContent.includes("LAST VALID RESULT"),
  );
  assert.equal(await page.locator("#export").isDisabled(), true);
  await screenshot("worker-error");
  await page.unroute("**/assets/worker-*.js");
  await page.locator("#retry").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^0/);
  check(
    "Real worker timeout marks stale result, disables export, and Retry recovers",
  );
  await context.setOffline(true);
  await page.locator("#toggle-volunteer-b").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  await context.setOffline(false);
  check("Already-loaded app continues calculation offline");
  await page.goto(`http://127.0.0.1:${port}/breadrelay/`);
  await ready();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.className),
    "skip-link",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "main");
  check("Keyboard skip link reaches main planner");
  // Two data imports cover operator labels and escaped untrusted text.
  const malicious = structuredClone(demo);
  malicious.dataKind = "operator";
  malicious.pickups[0].label = "<img src=x onerror=alert(1)>";
  await upload(malicious);
  await page.waitForFunction(() =>
    document.querySelector("#offers")?.textContent.includes("<img src=x"),
  );
  await ready();
  assert.equal(await page.locator("#offers img").count(), 0);
  assert.match(await page.locator("#offers").innerText(), /<img src=x/);
  check("Imported labels render as text, without HTML execution");
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise((r) => setTimeout(r, 400));
      return read.call(this);
    };
  });
  const delayedImport = structuredClone(demo);
  delayedImport.volunteers.forEach((v) => (v.capacityGrams = 0));
  await upload(delayedImport);
  await page.locator("#reset").click();
  await ready();
  await page.waitForTimeout(600);
  assert.match(await page.locator("#result-title").innerText(), /^38/);
  check("A delayed file read cannot overwrite a later reset");
  await context.close();
  const fallbackContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await fallbackContext.addInitScript(() => {
    window.Worker = undefined;
  });
  page = await fallbackContext.newPage();
  await page.goto(`http://127.0.0.1:${port}/breadrelay/`);
  await ready();
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  check("Worker-unavailable fallback computes same validated result");
  await fallbackContext.close();
  // No unexpected page exceptions or HTTP errors are permitted; network aborts above are deliberate.
  assert.deepEqual(results.errors, []);
  assert.deepEqual(results.externalRequests, []);
  results.completedAt = new Date().toISOString();
  results.status = "passed";
} catch (e) {
  results.status = "failed";
  results.failure = e.stack;
  throw e;
} finally {
  await writeFile(
    resolve(artifacts, "INTERFACE_VERIFICATION.json"),
    JSON.stringify(results, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((done) => server.close(done));
  console.log(JSON.stringify(results, null, 2));
}
