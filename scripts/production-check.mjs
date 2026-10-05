import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteUrl =
  process.env.BREADRELAY_BASE_URL ||
  "https://nicholas-afk.github.io/breadrelay/";
assert.equal(
  new URL(siteUrl).protocol,
  "https:",
  "Production verification requires HTTPS",
);
const output = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
await mkdir(output, { recursive: true });
const version = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
).version;
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
  siteUrl,
  version,
  browser: browser.version(),
  checks: [],
  errors: [],
  externalRequests: [],
  screenshots: [],
  limits:
    "Automated desktop Chrome with desktop/phone viewports; not a physical device or human usability study.",
};
const check = (viewport, text) => result.checks.push(`${viewport}px: ${text}`);
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      acceptDownloads: true,
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on("pageerror", (e) => result.errors.push(e.message));
    page.on("request", (r) => {
      if (
        !r.url().startsWith("data:") &&
        new URL(r.url()).origin !== new URL(siteUrl).origin
      )
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
    const response = await page.goto(siteUrl);
    assert.equal(response.status(), 200);
    await ready();
    assert.equal(await page.evaluate(() => isSecureContext), true);
    assert.match(await page.locator("#result-title").innerText(), /^38/);
    assert.match(await page.locator("#data-note").innerText(), /Fictional/);
    await page.locator("#toggle-volunteer-a").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    assert.match(await page.locator(".comparison").innerText(), /18 kg/);
    check(
      width,
      "Normal HTTPS load and cancellation: 38 starting /18 unchanged /26 revised",
    );
    await page.locator("#why-bakery-c").click();
    assert.match(
      await page.locator("#alternative").innerText(),
      /23 kg scheduled/,
    );
    assert.match(
      await page.locator("#diff-added").innerText(),
      /Bakery C.*4 kg/s,
    );
    assert.match(
      await page.locator("#diff-removed").innerText(),
      /Bakery B.*7 kg/s,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    const tradeoff = `breadrelay-production-tradeoff-${width}.png`;
    await page
      .locator("#alternative")
      .screenshot({ path: resolve(output, tradeoff) });
    result.screenshots.push(tradeoff);
    await page.locator("#close-alternative").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "why-bakery-c",
    );
    check(
      width,
      "Real forced alternative and explicit substitution fit; closing returns focus and preserves selected plan",
    );
    const event = page.waitForEvent("download");
    await page.locator("#export").click();
    const path = await (await event).path(),
      report = JSON.parse(await readFile(path, "utf8"));
    assert.equal(report.appVersion, version);
    assert.equal(report.recovery.scheduledGrams, 26000);
    assert.equal(report.claims.actualDeliveryVerified, false);
    await page.locator("#close-export").click();
    await page.locator("#reset").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^38/);
    await Promise.all([
      page.waitForRequest((r) =>
        /\/assets\/worker-[^/]+\.js$/.test(new URL(r.url()).pathname),
      ),
      page.locator("#round-file").setInputFiles(path),
    ]);
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    assert.match(await page.locator(".comparison").innerText(), /18 kg/);
    assert.match(
      await page.locator("#result-band").innerText(),
      /Starting plan: 38 kg/,
    );
    check(
      width,
      "Actual versioned report download/reset/reopen recomputes the complete comparison",
    );
    await page.locator("#show-export").click();
    await page.locator("#copy-export").click();
    await page.waitForFunction(() =>
      /copied/i.test(document.querySelector("#export-feedback").textContent),
    );
    const copied = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    assert.equal(copied.appVersion, version);
    assert.equal(copied.recovery.scheduledGrams, 26000);
    await page.locator("#close-export").click();
    check(
      width,
      "Secure-context clipboard contains the selected current report",
    );
    await page
      .locator("#round-file")
      .setInputFiles({
        name: "broken.json",
        mimeType: "application/json",
        buffer: Buffer.from("{broken"),
      });
    await page.locator("#error-box").waitFor({ state: "visible" });
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    check(
      width,
      "Malformed import gives visible feedback without replacing checked routes",
    );
    if (width === 1440) {
      const name = "breadrelay-production-invalid-import.png";
      await page.screenshot({ path: resolve(output, name) });
      result.screenshots.push(name);
    }
    await page.locator("#reset").click();
    await ready();
    await page.locator("#toggle-volunteer-a").click();
    await ready();
    await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const name = `breadrelay-production-${width}.png`;
    await page.screenshot({
      path: resolve(output, name),
      fullPage: width === 1440,
    });
    result.screenshots.push(name);
    await page.emulateMedia({ media: "print" });
    assert.match(
      await page.locator("#print-context").innerText(),
      /Hong Kong|Asia\/Hong_Kong|HKT/,
    );
    assert.equal(await page.locator("#export").isVisible(), false);
    assert.ok((await page.locator(".route").count()) > 0);
    await page.emulateMedia({ media: "screen" });
    check(
      width,
      "Print composition keeps timed routes and provenance while hiding export controls",
    );
    await context.setOffline(true);
    await page.locator("#toggle-volunteer-b").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^0/);
    await page.locator("#toggle-volunteer-b").click();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    await context.setOffline(false);
    check(
      width,
      "Already-loaded round still calculates after network loss and crew restoration",
    );
    const direct = await page.goto(new URL("index.html#main", siteUrl).href);
    assert.equal(direct.status(), 200);
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^38/);
    await page.reload();
    await ready();
    assert.match(await page.locator("#result-title").innerText(), /^38/);
    const source = page.locator(
      'a[href="https://github.com/Nicholas-afk/breadrelay"]',
    );
    assert.equal(await source.count(), 1);
    assert.equal(await source.getAttribute("target"), "_blank");
    check(
      width,
      "Direct index/fragment link and reload work; source link preserves the in-memory page",
    );
    await context.close();
  }
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.externalRequests, []);
  result.status = "passed";
} catch (e) {
  result.status = "failed";
  result.failure = String(e.stack || e);
  process.exitCode = 1;
} finally {
  result.completedAt = new Date().toISOString();
  await writeFile(
    resolve(output, "PRODUCTION_VERIFICATION.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
