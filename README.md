# BreadRelay

A small, local collection planner for an evening bakery-surplus crew. Mark a volunteer unavailable, check timed replacement routes, inspect the cost of including an excluded pickup, and download or print the plan.

The bundled round is explicitly synthetic: 38 kg initially; cancelling Volunteer A leaves 18 kg on the unchanged route; replanning schedules 26 kg. These are scheduled quantities, not observed deliveries.

## Run

Use Node 22.18.0 and npm.

```sh
npm ci
npm run dev
```

For the compiled project-subpath preview:

```sh
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:4173/breadrelay/. `npm run check:browser` tests compiled files, not the development server. On macOS it uses installed Google Chrome; elsewhere run `npx playwright install chromium` first. Browser artifacts go to `test-results/` unless `BREADRELAY_ARTIFACTS` is set.

## Boundaries

At most 10 whole pickups, 3 volunteers, 3 pickups per volunteer, and one hub. Same-day times in Asia/Hong_Kong. Before-departure planning only. Fixed, supplied directed travel minutes; no navigation, GPS or live traffic. No accounts, backend, external runtime requests or browser API keys. Inputs remain in memory and are cleared on reload. Downloads are the durable record.

Crew availability, carrying capacity, shifts, pickup weight, collection windows, service minutes and hub deadlines are editable. Use Apply to validate a draft and recalculate; typing alone never dispatches a plan. Invalid inputs preserve the last applied round. The travel table under “What this plan checks” shows every supplied direction and minute.

Open a round JSON file (schema version 1) based on `src/fixtures/demo.json` to replace all inputs and pin a new starting plan. New locations or volunteers require a complete replacement file, including every travel cell. A saved plan report instead restores both starting and changed inputs, then recomputes every plan and explanation. Imported totals, routes and claims are ignored. Reports must compare the same service date, pickup IDs and volunteer IDs. Files are limited to256 KiB and rejected transactionally if invalid.

“Download plan” creates a report and exposes its full JSON. “Copy or save” offers the same report for copying; “Save current round” creates a reusable round file. Denied clipboard access selects the text for manual copying. A failed download leaves that text available. Print routes preserves source/date/timezone and all arrival, wait, collection, load and deadline details. Pending or failed calculations disable current exports and label the last checked routes. Unsaved field drafts survive calculation responses.

## Implementation

Native HTML/CSS, TypeScript, Vite and a module worker. An exact bounded route enumeration and disjoint-subset dynamic program maximize grams, then retain earlier volunteer assignments, then minimize travel. A separate route validator recomputes timing and load. See `docs/algorithm.md`, `docs/evaluation.md` and `AI_DISCLOSURE.md`.

The relative asset build is compatible with static project-subpath hosting. GitHub Pages deployment has not yet been performed. No server is needed.

Only validated schema fields are kept when opening a round. Unspecified extra JSON is discarded, keeping saved reports within the supported format. Over-limit lists stop at count validation; error summaries show at most12 corrections at once.

## Verify

`npm test` covers the real optimizer, independent plan validation, scenario/file contracts and hand-checked edge fixtures;350 generated objectives are compared with an independent exhaustive oracle. `npm run build` performs strict type checking. `npm run check:browser` runs both compiled-browser suites, including keyboard cancellation-to-report, report restoration, offer edits, print/mobile layouts, offline-after-load, worker failure, timeout/retry, revision isolation and download/clipboard failures. Injected failures are test conditions, not application metrics. `npm run benchmark` measures30 complete bounded calculations in the compiled worker. Evidence and limitations are in `docs/evaluation.md`.

`npm run evaluate` replays100 seeded synthetic cancellation rounds against unchanged routes and a defined weight-first greedy insertion comparator. It reports modeled scheduled weight, not food delivered or field-effect estimates. `npx playwright install webkit` followed by `npm run check:webkit` runs the additional browser-engine journey. A desktop WebKit engine at phone widths does not replace real Safari/iPhone or assistive-technology testing.
