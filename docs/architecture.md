# Architecture and data boundaries

BreadRelay is a static, single-page TypeScript application. GitHub Pages serves the HTML, CSS, JavaScript and module worker. There is no application server, database, account system, runtime model API or map integration. No production environment variable or API credential is required.

```mermaid
flowchart LR
  Input[Prepared round or saved report] --> Validate[Bounded input validation]
  Validate --> Session[Applied inputs and revision]
  Session --> Worker[Local module worker]
  Worker --> Solver[Exact bounded planner]
  Solver --> Check[Independent plan validation]
  Check --> View[Current routes and pickup alternatives]
  View --> Output[Local JSON download or print]
```

The controller in `src/app/main.ts` keeps the pinned starting round and current applied round. Field edits are drafts until Apply. Input validation in `src/domain/scenario.ts` checks IDs, counts, integer values, same-day times and every directed travel cell. Files are limited to 256 KiB. Unspecified extra JSON is discarded; imported totals, routes and delivery claims are never trusted.

`src/app/worker-client.ts` terminates superseded workers and accepts only the current revision. `src/planner/calculate.ts` builds the starting plan, re-simulates unchanged routes, solves the changed round and computes forced-pickup alternatives. `src/planner/validate-plan.ts` independently reconstructs timing, loads and totals. See [algorithm.md](algorithm.md) for the objective and search.

The worker returns a checked snapshot. Pending and failed computations label prior routes as last checked and disable current exports. Worker startup failure uses the same bounded calculation locally; a five-second calculation timeout remains a visible error with Retry. This fallback does not create a remote service.

`src/ui/routes.ts` renders route details and derives pickup additions/removals and volunteer transfers from the selected and alternative plans. Imported labels are escaped as text. Opening a preview does not replace the selected plan. `src/io/round-file.ts` reconstructs validated inputs; `src/io/report.ts` produces schema-version-1 reports; `src/io/plan-delivery.ts` handles download, clipboard fallback and printing.

## Production configuration

| Boundary     | Configuration                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Frontend     | Relative Vite asset base `./`; ES module worker; one HTML entry                                                     |
| Hosting      | Public project repository; compiled `gh-pages` branch root; enforced HTTPS                                          |
| Routes       | One page at `/breadrelay/`; `index.html` and fragment links work without a history router                           |
| Dependencies | Locked build/test tools; no runtime UI library, CDN, external font or paid API                                      |
| Data         | Visitor inputs stay in browser memory; files and clipboard are user-directed outputs                                |
| Persistence  | Reload starts the sample; saved reports are the durable record                                                      |
| Networking   | Same-origin static assets/worker; the source link opens GitHub only when followed                                   |
| Build gate   | Clean locked install, native tests, strict build and browser verification before publishing; no custom automatic CI |

GitHub necessarily handles requests for the public static site. Local processing does not mean the host receives no access logs. BreadRelay sends no round inputs to an application backend and has no analytics. A downloaded report contains the supplied round, so sharing that file shares its contents.

## Implemented scope and limits

Availability, shifts, carrying limits, pickup weights/windows/service times and hub deadlines are editable. Complete JSON replacement supports different locations, volunteers and travel values. Reports preserve the two input rounds and recompute on reopening. Routes include arrival, waiting, service, cumulative load and return slack. Independent oracle and comparator evidence is described in [evaluation.md](evaluation.md).

The bounded model supports ten whole pickups, three volunteers, three stops per volunteer and one hub, before departure on one Hong Kong service day. Travel minutes are supplied and fixed, not navigation or live traffic. There is no overnight or in-progress dispatch model, food-safety assessment, messaging, user account or measured delivery outcome. Structural setup requires a complete round file. Initial loading needs connectivity; already-loaded computation is tested offline, while fresh offline reload is not promised. Physical-device, comprehensive assistive-technology and Firefox coverage and real operator feedback remain unverified.
