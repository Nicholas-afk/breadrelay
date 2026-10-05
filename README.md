# BreadRelay

A small, local collection planner for an evening bakery-surplus crew. Mark a volunteer unavailable, check timed replacement routes, inspect the cost of including an excluded pickup, and download or print the plan.

The bundled round is explicitly synthetic: 38 kg initially; cancelling Volunteer A leaves 18 kg on the unchanged route; replanning schedules 26 kg. These are scheduled quantities, not observed deliveries.

[Try BreadRelay](https://nicholas-afk.github.io/breadrelay/) · [Source](https://github.com/Nicholas-afk/breadrelay) · [Releases](https://github.com/Nicholas-afk/breadrelay/releases)

## Try the central workflow

1. Mark Volunteer A unavailable: compare 18 kg on the feasible unchanged route with 26 kg in the revised plan.
2. Choose “Review the trade-offs,” then “Why this pickup?” for Bakery C. A real forced-inclusion solve schedules 23 kg: it adds Bakery C's 4 kg and leaves out Bakery B's 7 kg. The selected 26 kg plan stays intact.
3. Download or print the selected routes. Open the downloaded report to reconstruct the same two rounds and recompute every result.

This is a before-departure prototype for a small prepared collection round. It has no operator endorsement or observed food-delivery result. Structural setup uses a complete round JSON file; supplied minutes are not live road estimates.

## Run

Use Node 22.18.0 and npm10.9.3. Clone the public source first:

```sh
git clone https://github.com/Nicholas-afk/breadrelay.git
cd breadrelay
```

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

Open a round JSON file (schema version 1) based on `src/fixtures/demo.json` to replace all inputs and pin a new starting plan. New locations or volunteers require a complete replacement file, including every travel cell. A saved plan report instead restores both starting and changed inputs, then recomputes every plan and explanation. Imported totals, routes and claims are ignored. Reports must compare the same service date, pickup IDs and volunteer IDs. Files are limited to 256 KiB and rejected transactionally if invalid.

“Download plan” creates a report and exposes its full JSON. “Copy or save” offers the same report for copying; “Save current round” creates a reusable round file. Denied clipboard access selects the text for manual copying. A failed download leaves that text available. Print routes preserves source/date/timezone and all arrival, wait, collection, load and deadline details. Pending or failed calculations disable current exports and label the last checked routes. Unsaved field drafts survive calculation responses.

## Implementation

Native HTML/CSS, TypeScript, Vite and a module worker. An exact bounded route enumeration and disjoint-subset dynamic program maximize grams, then retain earlier volunteer assignments, then minimize travel. A separate route validator recomputes timing and load. See [architecture and data boundaries](docs/architecture.md), [algorithm](docs/algorithm.md), [evaluation](docs/evaluation.md) and [AI disclosure](AI_DISCLOSURE.md).

The relative asset build supports static project-subpath hosting. The source is on `main`; the compiled `gh-pages` branch is the publishing source. No server is needed. See `docs/hosting.md` for the verification and rollback procedure.

Only validated schema fields are kept when opening a round. Unspecified extra JSON is discarded, keeping saved reports within the supported format. Over-limit lists stop at count validation; error summaries show at most 12 corrections at once.

## Verify

`npm test` covers the real optimizer, independent plan validation, scenario/file contracts and hand-checked edge fixtures; 350 generated objectives are compared with an independent exhaustive oracle. `npm run build` performs strict type checking. `npm run check:browser` runs both compiled-browser suites, including keyboard cancellation-to-report, report restoration, offer edits, print/mobile layouts, offline-after-load, worker failure, timeout/retry, revision isolation and download/clipboard failures. Injected failures are test conditions, not application metrics. `npm run benchmark` measures 30 complete bounded calculations in the compiled worker. Evidence and limitations are in `docs/evaluation.md`.

`npm run evaluate` replays 100 seeded synthetic cancellation rounds against unchanged routes and a defined weight-first greedy insertion comparator. It reports modeled scheduled weight, not food delivered or field-effect estimates. `npx playwright install webkit` followed by `npm run check:webkit` runs the additional browser-engine journey. A desktop WebKit engine at phone widths does not replace real Safari/iPhone or assistive-technology testing.

`npm run check:improvements` checks the actual add/drop breakdown against downloaded plans, all three sample alternatives, infeasible/empty handling, desktop/phone layout and refresh. Set `BREADRELAY_BASE_URL=https://nicholas-afk.github.io/breadrelay/` to run the same journey on the deployed HTTPS site.

In the seeded 100-case comparison, total modeled scheduled weight is 1,688 kg unchanged, 1,830 kg with a defined greedy insertion planner and 1,956 kg with exact recovery. Exact improves over unchanged in 57 cases and over greedy in 34, matching the remainder. These are generated cases with shared feasibility simulation for greedy; independent correctness comes from the 350-case exhaustive oracle and separate returned-plan validator. They do not establish field benefit or superiority to an existing vendor.

## Attribution and licensing

Codex contributed substantially; the running app performs no AI inference. Research sources, synthetic-data provenance and tool attribution are in [docs/attribution.md](docs/attribution.md). Original project source currently has no open-source license grant (`UNLICENSED`); [LICENSE.md](LICENSE.md) records that status. [Locked dependency licenses](docs/dependency-licenses.md) and the published [Vite helper notice](public/THIRD_PARTY_NOTICES.txt) distinguish third-party terms.

The public site needs no backend, production environment variables or API credentials. GitHub Pages serves its static files; the host handles ordinary access requests while round inputs are processed locally. Initial load needs connectivity. Release archives and manifests preserve source/build hashes and a restorable checkpoint.

`npm run check:production` checks the actual public HTTPS site at1440/390/320 px, including report/download/reset/reopen, clipboard, malformed input, print, network loss, direct index/fragment links and reload. Set `BREADRELAY_BASE_URL` to another HTTPS deployment when verifying a release candidate; the downloaded report version must match this checkout. These are automated browser checks, not physical-device or human usability evidence.
