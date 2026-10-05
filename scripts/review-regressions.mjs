import { chromium } from "playwright";
import assert from "node:assert/strict";
import { serve } from "./serve-static.mjs";
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${port}/breadrelay/`);
  await page.waitForFunction(
    () =>
      document.querySelector("#result-band").getAttribute("aria-busy") ===
      "false",
  );
  await page.emulateMedia({ media: "print" });
  const context = (await page.locator("#print-context").count())
    ? await page.locator("#print-context").innerText()
    : "";
  await page.emulateMedia({ media: "screen" });
  await page.route("**/assets/worker-*.js", async (route) => {
    await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
  await page.locator("#toggle-volunteer-a").click();
  await page.locator("#limits-volunteer-b summary").click();
  await page.locator("#capacity-volunteer-b").fill("25.123");
  await page.waitForFunction(
    () =>
      document.querySelector("#result-band").getAttribute("aria-busy") ===
      "false",
  );
  const draft = await page.locator("#capacity-volunteer-b").inputValue();
  console.log(JSON.stringify({ printContext: context, draftCapacity: draft }));
  assert.ok(
    context.includes("synthetic") &&
      context.includes("2026-10-06") &&
      context.includes("Hong Kong"),
  );
  assert.equal(draft, "25.123");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
