import { webkit } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./serve-static.mjs";
const output = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
await mkdir(output, { recursive: true });
const server = await serve(0),
  base = `http://127.0.0.1:${server.address().port}`;
const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const result = {
  engine: "Playwright WebKit",
  version: browser.version(),
  limits:
    "Desktop WebKit browser engine, including phone-size viewport; not a physical iPhone/Safari or assistive-technology test",
  checks: [],
  errors: [],
  externalRequests: [],
};
page.on("pageerror", (e) => result.errors.push(e.message));
page.on("request", (r) => {
  if (!r.url().startsWith(base) && !r.url().startsWith("data:"))
    result.externalRequests.push(r.url());
});
const ready = () =>
  page.waitForFunction(
    () =>
      document.querySelector("#result-band")?.getAttribute("aria-busy") ===
        "false" &&
      !document
        .querySelector("#result-band")
        ?.textContent.includes("LAST VALID RESULT"),
  );
const check = (name) => result.checks.push(name);
try {
  await page.goto(base + "/breadrelay/");
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^38/);
  check(
    "Fresh visitor gets the computed 38 kg sample, with local worker and assets",
  );
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  assert.match(await page.locator(".comparison").innerText(), /18 kg/);
  check("Cancellation computes 18 kg unchanged and 26 kg revised");
  await page.locator("#review-unassigned").click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "why-bakery-c",
  );
  await page.keyboard.press("Enter");
  assert.match(
    await page.locator("#alternative").innerText(),
    /23 kg scheduled/,
  );
  await page.locator("#close-alternative").click();
  check(
    "Keyboard focus enters the genuine 23 kg counterfactual and returns on close",
  );
  const event = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await event;
  const report = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(report.recovery.scheduledGrams, 26000);
  assert.equal(report.claims.actualDeliveryVerified, false);
  check(
    "Actual downloaded report matches the current calculation and provenance",
  );
  await page.locator("#reset").click();
  await ready();
  await Promise.all([
    page.waitForRequest((r) =>
      /\/assets\/worker-[^/]+\.js$/.test(new URL(r.url()).pathname),
    ),
    page
      .locator("#round-file")
      .setInputFiles({
        name: "plan.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(report)),
      }),
  ]);
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  check(
    "Saved report restores both inputs and recalculates the same comparison",
  );
  await page.locator("#pickup-limits-bakery-f summary").click();
  await page.locator("#weight-bakery-f").fill("13");
  await page.locator("#apply-pickup-bakery-f").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^27/);
  check("Native weight/time input workflow applies a valid offer edit");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(50);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page
      .locator("#pickup-limits-bakery-f")
      .screenshot({
        path: resolve(output, `breadrelay-webkit-editor-${width}.png`),
      });
  }
  check("Open offer editor fits 390 and 320 px without page overflow");
  await page.emulateMedia({ media: "print" });
  assert.match(await page.locator("#print-context").innerText(), /synthetic/);
  assert.equal(await page.locator("#export-panel").isVisible(), false);
  assert.equal(await page.locator(".crew-section").isVisible(), false);
  await page.emulateMedia({ media: "screen" });
  check("Print preserves source/date context and excludes controls");
  for (let i = 0; i < 3; i++) {
    await page.locator("#toggle-volunteer-b").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^0/);
    await page.locator("#toggle-volunteer-b").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^27/);
  }
  check("Repeated empty/restored crew changes remain consistent");
  await context.setOffline(true);
  await page.locator("#toggle-volunteer-b").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^0/);
  await context.setOffline(false);
  check(
    "Already-loaded app handles network loss via the bounded calculation fallback",
  );
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.externalRequests, []);
  result.status = "passed";
} catch (e) {
  result.status = "failed";
  result.failure = e.stack;
  process.exitCode = 1;
} finally {
  result.completedAt = new Date().toISOString();
  await writeFile(
    resolve(output, "WEBKIT_VERIFICATION.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((done) => server.close(done));
  console.log(JSON.stringify(result, null, 2));
}
