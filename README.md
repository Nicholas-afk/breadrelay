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

Open a scenario JSON file (schema version 1) based on `src/fixtures/demo.json`; the import is validated before replacing the current round. Downloaded reports are a separate format and are not currently reimportable. Capacity and shift times are editable in the interface. Pickup and travel-table editing currently require a round file.

## Implementation

Native HTML/CSS, TypeScript, Vite and a module worker. An exact bounded route enumeration and disjoint-subset dynamic program maximize grams, then retain earlier volunteer assignments, then minimize travel. A separate route validator recomputes timing and load. See `docs/algorithm.md`, `docs/evaluation.md` and `AI_DISCLOSURE.md`.

The relative asset build is compatible with static project-subpath hosting. GitHub Pages deployment has not yet been performed. No server is needed.
