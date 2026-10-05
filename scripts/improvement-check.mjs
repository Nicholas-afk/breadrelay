import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "./serve-static.mjs";

const output = resolve(process.env.BREADRELAY_ARTIFACTS || "test-results");
await mkdir(output, { recursive: true });
const server = process.env.BREADRELAY_BASE_URL ? null : await serve(0);
const siteUrl =
  process.env.BREADRELAY_BASE_URL ||
  `http://127.0.0.1:${server.address().port}/breadrelay/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "darwin"
    ? {
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(4000);
const result = {
  siteUrl,
  browser: browser.version(),
  checks: [],
  errors: [],
  externalRequests: [],
  screenshots: [],
};
page.on("pageerror", (e) => result.errors.push(e.message));
page.on("request", (r) => {
  if (
    new URL(r.url()).origin !== new URL(siteUrl).origin &&
    !r.url().startsWith("data:")
  )
    result.externalRequests.push(r.url());
});
const ready = () =>
  page.waitForFunction(
    () =>
      document.querySelector("#result-band")?.getAttribute("aria-busy") ===
      "false",
  );
const check = (value) => result.checks.push(value);
try {
  await page.goto(siteUrl);
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^38/);
  await page.locator("#toggle-volunteer-a").click();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^26/);
  assert.match(await page.locator(".comparison").innerText(), /18 kg/);
  check("Fresh visitor reaches the validated 38→18→26 cancellation workflow");
  for (const id of ["bakery-c", "bakery-d", "bakery-e"]) {
    await page.locator(`#why-${id}`).click();
    assert.match(
      await page.locator("#alternative").innerText(),
      /23 kg scheduled/,
    );
    assert.match(
      await page.locator("#plan-difference").innerText(),
      /selected 26 kg plan/,
    );
    assert.match(
      await page.locator("#diff-added").innerText(),
      new RegExp(`Bakery ${id.at(-1).toUpperCase()}.*4 kg`, "s"),
    );
    assert.match(
      await page.locator("#diff-removed").innerText(),
      /Bakery B.*7 kg/s,
    );
    assert.match(await page.locator("#result-title").innerText(), /^26/);
    await page.locator("#close-alternative").click();
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      `why-${id}`,
    );
  }
  check(
    "All three forced previews explicitly add 4 kg and leave out Bakery B's 7 kg, preserving the selected 26 kg plan and focus",
  );
  await page.locator("#why-bakery-c").click();
  const event = page.waitForEvent("download");
  await page.locator("#export").click();
  const report = JSON.parse(await readFile(await (await event).path(), "utf8"));
  assert.equal(report.recovery.scheduledGrams, 26000);
  const alt = report.explanations.find(
    (e) => e.pickupId === "bakery-c",
  ).alternative;
  assert.equal(alt.scheduledGrams, 23000);
  assert.deepEqual(
    alt.assignedIds.filter((id) => !report.recovery.assignedIds.includes(id)),
    ["bakery-c"],
  );
  assert.deepEqual(
    report.recovery.assignedIds.filter((id) => !alt.assignedIds.includes(id)),
    ["bakery-b"],
  );
  check(
    "Actual downloaded selected/alternative plans independently support the displayed pickup difference",
  );
  await page.locator("#close-export").click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.locator("#alternative").screenshot({
      path: resolve(output, `breadrelay-tradeoff-${width}.png`),
    });
    result.screenshots.push(`breadrelay-tradeoff-${width}.png`);
  }
  check(
    "Explicit trade-off fits desktop and 390/320 px without horizontal page overflow",
  );
  await page.locator("#close-alternative").click();
  await page.locator("#toggle-volunteer-b").click();
  await ready();
  await page.locator("#why-bakery-c").click();
  assert.match(
    await page.locator("#alternative").innerText(),
    /No available volunteer can include/,
  );
  assert.equal(await page.locator("#plan-difference").count(), 0);
  check("An infeasible forced pickup has no invented add/drop alternative");
  await page.reload();
  await ready();
  assert.match(await page.locator("#result-title").innerText(), /^38/);
  assert.ok(
    !(await page.locator("#result-band").innerText()).includes("crew below"),
  );
  assert.match(await page.locator("#data-note").innerText(), /Fictional/);
  check(
    "Direct refresh recomputes the labelled sample and uses layout-independent crew wording",
  );
  const longRound = JSON.parse(
    await readFile(
      new URL("../src/fixtures/demo.json", import.meta.url),
      "utf8",
    ),
  );
  longRound.pickups.find((p) => p.id === "bakery-c").label = "C".repeat(80);
  longRound.volunteers[0].available = false;
  await Promise.all([
    page.waitForRequest((r) =>
      /\/assets\/worker-[^/]+\.js$/.test(new URL(r.url()).pathname),
    ),
    page.locator("#round-file").setInputFiles({
      name: "long-label.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(longRound)),
    }),
  ]);
  await ready();
  await page.locator("#why-bakery-c").click();
  const longLabelWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  result.longLabelPageWidth = longLabelWidth;
  assert.equal(
    longLabelWidth,
    320,
    "A valid 80-character label must fit the 320 px page",
  );
  assert.equal(
    await page.locator("#diff-added strong").innerText(),
    "C".repeat(80),
  );
  assert.ok(
    (await page.locator("#close-alternative").boundingBox()).width >= 44,
    "The close control remains a usable phone target beside a long label",
  );
  await page.locator("#alternative").screenshot({
    path: resolve(output, "breadrelay-tradeoff-long-label-320.png"),
  });
  result.screenshots.push("breadrelay-tradeoff-long-label-320.png");
  check(
    "Valid unbroken80-character imported labels wrap without hiding text or widening the phone page",
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
    resolve(
      output,
      process.env.BREADRELAY_BASE_URL
        ? "DEPLOYED_JOURNEY.json"
        : "IMPROVEMENT_VERIFICATION.json",
    ),
    JSON.stringify(result, null, 2) + "\n",
  );
  await browser.close();
  if (server) await new Promise((done) => server.close(done));
  console.log(JSON.stringify(result, null, 2));
}
