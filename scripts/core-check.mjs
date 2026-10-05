import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./serve-static.mjs";
const artifacts = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
await mkdir(artifacts, { recursive: true });
const server = await serve(0);
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "darwin"
    ? {
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      }
    : {}),
});
const result = {
  browser: browser.version(),
  checks: [],
  errors: [],
  externalRequests: [],
  screenshots: [],
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(3000);
const base = `http://127.0.0.1:${server.address().port}`;
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
const upload = async (value) => {
  // Await the new calculation's asset request, not the previous round's already-ready state.
  await Promise.all([
    page.waitForRequest((request) =>
      /\/assets\/worker-[^/]+\.js$/.test(new URL(request.url()).pathname),
    ),
    page.locator("#round-file").setInputFiles({
      name: "round.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(value)),
    }),
  ]);
};
const capture = async (name) => {
  await page.screenshot({
    path: resolve(artifacts, `breadrelay-core-${name}.png`),
    fullPage: true,
  });
  result.screenshots.push(`breadrelay-core-${name}.png`);
};
const check = (name) => result.checks.push(name);
try {
  await page.goto(base + "/breadrelay/");
  await ready();
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  assert.match(
    await page.locator("#unassigned-note").innerText(),
    /12 kg.*3 pickups/,
  );
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
    "Current result leads directly to unassigned-pickup trade-offs, with keyboard focus",
  );
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadEvent;
  const report = JSON.parse(await readFile(await download.path(), "utf8"));
  report.recovery.scheduledGrams = 999999;
  report.referencePlan.routes = [];
  await page.locator("#reset").click();
  await ready();
  await upload(report);
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  assert.match(await page.locator(".comparison").innerText(), /18 kg/);
  assert.match(await page.locator(".reference").innerText(), /38 kg/);
  check(
    "Tampered report restored from validated inputs: 38 starting / 18 baseline / 26 revised",
  );
  if (process.env.BREADRELAY_CORE_STEP === "restore") {
    result.status = "passed";
  } else {
    await page.locator("#pickup-limits-bakery-f summary").click();
    await page.locator("#weight-bakery-f").fill("0");
    await page.locator("#apply-pickup-bakery-f").click();
    assert.equal(
      await page.locator("#weight-bakery-f").getAttribute("aria-invalid"),
      "true",
    );
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    await page.locator("#error-box a").first().click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "weight-bakery-f",
    );
    check("Invalid pickup weight preserves prior routes and focuses the field");
    await page.locator("#weight-bakery-f").fill("13");
    await page.locator("#close-bakery-f").fill("18:00");
    await page.locator("#apply-pickup-bakery-f").click();
    assert.equal(
      await page.locator("#close-bakery-f").getAttribute("aria-invalid"),
      "true",
    );
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    await page.locator("#close-bakery-f").fill("19:55");
    await page.locator("#apply-pickup-bakery-f").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^27/);
    assert.match(await page.locator(".reference").innerText(), /38 kg/);
    assert.equal(await page.locator("#error-box").isHidden(), true);
    check(
      "Pickup edit applied transactionally: revised 27 kg and pinned 38 kg reference",
    );
    if (process.env.BREADRELAY_CORE_STEP === "pickup") result.status = "passed";
    else {
      await page.locator("#show-export").click();
      const exported = JSON.parse(
        await page.locator("#export-text").inputValue(),
      );
      assert.equal(exported.currentScenario.pickups[5].weightGrams, 13000);
      assert.equal(exported.referenceScenario.pickups[5].weightGrams, 12000);
      assert.equal(exported.recovery.scheduledGrams, 27000);
      assert.equal(exported.claims.actualDeliveryVerified, false);
      await page.locator("#reset").click();
      await ready();
      await upload(exported);
      await ready();
      assert.match(await page.locator("#result-title").innerText(), /^27/);
      check("Edited report text restores the same reference and result");
      await page.locator("#show-export").click();
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.locator("#copy-export").click();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(JSON.parse(copied).recovery.scheduledGrams, 27000);
      check("Real browser clipboard receives the complete current report");
      const deniedClipboard = page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("Permission denied");
            },
          },
        }),
      );
      await deniedClipboard;
      await page.locator("#copy-export").click();
      assert.match(
        await page.locator("#export-feedback").innerText(),
        /select|selected/i,
      );
      const selection = await page
        .locator("#export-text")
        .evaluate((el) => el.selectionEnd - el.selectionStart);
      assert.ok(selection > 100);
      check(
        "Denied clipboard preserves and selects complete JSON for manual copying",
      );
      await capture("save-fallback");
      await page.evaluate(() =>
        Object.defineProperty(URL, "createObjectURL", {
          configurable: true,
          value: () => {
            throw new Error("Downloads unavailable");
          },
        }),
      );
      await page.locator("#export").click();
      assert.match(
        await page.locator("#export-feedback").innerText(),
        /could not|unavailable/i,
      );
      assert.ok(
        JSON.parse(await page.locator("#export-text").inputValue()).recovery,
      );
      check(
        "Download failure leaves a usable complete report, without an uncaught error",
      );
      await page.locator(".method > summary").click();
      await page.locator("#sample-file").click();
      await page.locator("#error-box").waitFor({ state: "visible" });
      assert.match(await page.locator("#error-box").innerText(), /download/i);
      assert.match(await page.locator("#result-title").innerText(), /^27/);
      check(
        "Sample download failure gives useful feedback and preserves the current plan",
      );
      await page.locator("#save-round").click();
      const savedRound = JSON.parse(
        await page.locator("#export-text").inputValue(),
      );
      assert.equal(savedRound.schemaVersion, 1);
      assert.equal(savedRound.pickups[5].weightGrams, 13000);
      assert.equal(savedRound.volunteers[0].available, false);
      await upload(savedRound);
      await ready();
      assert.match(await page.locator("#result-title").innerText(), /^27/);
      assert.equal(await page.locator(".comparison").count(), 0);
      check("Current-round JSON opens as a fresh reference");
      if ((await page.locator(".method").getAttribute("open")) === null)
        await page.locator(".method > summary").click();
      assert.equal(await page.locator("#travel-table tbody tr").count(), 7);
      assert.equal(await page.locator("#travel-table tbody td").count(), 49);
      assert.equal(
        await page
          .locator("#travel-table tbody tr")
          .first()
          .locator("td")
          .nth(1)
          .innerText(),
        String(savedRound.travelMinutes.hub["bakery-a"]),
      );
      check(
        "All directed travel cells are visible with origin/destination labels",
      );
      assert.match(await page.locator("#routes").innerText(), /load/);
      assert.match(await page.locator("#routes").innerText(), /Arrive/);
      check(
        "Route sheet shows actual arrival, waiting, service, cumulative load and hub slack",
      );
      await capture("desktop");
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(50);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        if (
          (await page
            .locator("#pickup-limits-bakery-f")
            .getAttribute("open")) === null
        )
          await page.locator("#pickup-limits-bakery-f summary").click();
        await capture(`mobile-${width}`);
        const editorCapture = `breadrelay-core-editor-${width}.png`;
        await page
          .locator("#pickup-limits-bakery-f")
          .screenshot({ path: resolve(artifacts, editorCapture) });
        result.screenshots.push(editorCapture);
        await page.locator("#pickup-limits-bakery-f summary").click();
        await page.locator("#show-export").click();
        const bandBox = await page.locator("#result-band").boundingBox(),
          saveBox = await page.locator("#export-panel").boundingBox();
        assert.ok(
          saveBox.y >= bandBox.y + bandBox.height,
          "Mobile saving follows the result visually",
        );
        assert.equal(
          await page.evaluate(() =>
            Boolean(
              document
                .querySelector("#result-band")
                .compareDocumentPosition(
                  document.querySelector("#copy-export"),
                ) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          ),
          true,
        );
        await page.locator("#close-export").click();
      }
      check(
        "Offer editing, matrix and exports fit 390 px and 320 px without page overflow",
      );
      check(
        "Mobile save panel follows the result in visual and keyboard order",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator("#export-panel").isVisible(), false);
      assert.equal(
        await page.locator("#offers details").first().isVisible(),
        false,
      );
      assert.match(
        await page.locator("#print-context").innerText(),
        /synthetic/,
      );
      await capture("print");
      await page.emulateMedia({ media: "screen" });
      check(
        "Print includes provenance and current routes, without editors or export JSON",
      );
      await page.reload();
      await ready();
      for (const [crew, start] of [
        ["a", "19:28"],
        ["b", "19:26"],
      ]) {
        await page.locator(`#limits-volunteer-${crew} summary`).click();
        await page.locator(`#start-volunteer-${crew}`).fill(start);
        await page.locator(`#apply-volunteer-${crew}`).click();
        await ready();
      }
      assert.match(await page.locator("#result-title").innerText(), /^27/);
      assert.match(await page.locator(".comparison").innerText(), /0 kg/);
      await page.locator("#baseline-details summary").click();
      assert.match(
        await page.locator("#baseline-details").innerText(),
        /Volunteer A/,
      );
      assert.match(
        await page.locator("#baseline-details").innerText(),
        /Volunteer B/,
      );
      check(
        "Both shifts delayed 20 minutes: invalid unchanged routes drop to 0, revised routes schedule 27 kg",
      );
      const demo = JSON.parse(
        await readFile(
          new URL("../src/fixtures/demo.json", import.meta.url),
          "utf8",
        ),
      );
      const operator = structuredClone(demo);
      operator.dataKind = "operator";
      operator.travelSource =
        "Coordinator-entered test values, not live traffic";
      await upload(operator);
      await ready();
      assert.match(await page.locator("#data-note").innerText(), /Your round/);
      assert.match(
        await page.locator("#data-note").innerText(),
        /no live traffic/,
      );
      check(
        "Operator-supplied data is visibly distinct from the fictional sample",
      );
      const invalid = structuredClone(operator);
      delete invalid.travelMinutes.hub["bakery-a"];
      await page.locator("#round-file").setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(invalid)),
      });
      await page.locator("#error-box").waitFor({ state: "visible" });
      assert.match(await page.locator("#result-title").innerText(), /^38/);
      assert.match(await page.locator("#data-note").innerText(), /Your round/);
      check(
        "Missing directed travel rejects the file while preserving the complete applied round",
      );
      const malformed = { ...operator, pickups: Array(50000).fill({}) };
      let rejectedAt = Date.now();
      await page.locator("#round-file").setInputFiles({
        name: "many.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(malformed)),
      });
      await page.waitForFunction(() =>
        document
          .querySelector("#error-box")
          ?.textContent.includes("at most 10 pickups"),
      );
      assert.ok((await page.locator("#error-box li").count()) <= 12);
      result.overLimitFileRejectMs = Date.now() - rejectedAt;
      const manyErrors = { ...operator, pickups: Array(10).fill({}) };
      await page.locator("#round-file").setInputFiles({
        name: "fields.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(manyErrors)),
      });
      await page.waitForFunction(() =>
        document.querySelector("#error-box")?.textContent.includes("Showing"),
      );
      assert.ok((await page.locator("#error-box li").count()) <= 12);
      assert.match(await page.locator("#result-title").innerText(), /^38/);
      check(
        "Malformed in-size files are rejected with bounded feedback and preserve the applied round",
      );
      await page.locator("#reset").click();
      await ready();
      const tabTo = async (id, backwards = false) => {
        for (let i = 0; i < 100; i++) {
          if ((await page.evaluate(() => document.activeElement.id)) === id)
            return;
          await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
        }
        assert.fail(`Keyboard could not reach ${id}`);
      };
      await tabTo("toggle-volunteer-a");
      await page.keyboard.press("Space");
      await ready();
      await tabTo("why-bakery-c");
      await page.keyboard.press("Enter");
      assert.match(
        await page.locator("#alternative").innerText(),
        /23 kg scheduled/,
      );
      await tabTo("close-alternative");
      await page.keyboard.press("Enter");
      await tabTo("export", true);
      const keyboardDownload = page.waitForEvent("download");
      await page.keyboard.press("Enter");
      const finalReport = JSON.parse(
        await readFile(await (await keyboardDownload).path(), "utf8"),
      );
      assert.equal(finalReport.recovery.scheduledGrams, 26000);
      check(
        "Full keyboard journey: cancel, inspect 23 kg alternative, close and download the current 26 kg plan",
      );
      await page.route("**/assets/worker-*.js", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        await route.continue();
      });
      await page.locator("#pickup-limits-bakery-f summary").click();
      await page.locator("#weight-bakery-f").fill("13");
      await page.locator("#apply-pickup-bakery-f").click();
      assert.equal(await page.locator("#export").isDisabled(), true);
      assert.match(
        await page.locator("#result-title").innerText(),
        /26 kg last checked/,
      );
      assert.equal(
        await page.locator("#routes .stop-weight").last().innerText(),
        "12 kg",
      );
      assert.match(
        await page
          .locator("#pickup-limits-bakery-f")
          .locator("..")
          .locator(".offer-assignment")
          .innerText(),
        /Checking/,
      );
      await page.locator("#pickup-limits-bakery-c summary").click();
      await page.locator("#weight-bakery-c").fill("4.125");
      await ready();
      assert.equal(
        await page.locator("#weight-bakery-c").inputValue(),
        "4.125",
      );
      assert.match(await page.locator("#result-title").innerText(), /^27/);
      await page.unroute("**/assets/worker-*.js");
      check(
        "Pending pickup edits retain the last checked route inputs; other unfinished offers survive calculation",
      );
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.externalRequests, []);
      result.status = "passed";
    }
  }
} catch (e) {
  result.status = "failed";
  result.failure = e.stack;
  process.exitCode = 1;
} finally {
  result.completedAt = new Date().toISOString();
  await writeFile(
    resolve(artifacts, "CORE_VERIFICATION.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  await browser.close();
  await new Promise((done) => server.close(done));
  console.log(JSON.stringify(result, null, 2));
}
