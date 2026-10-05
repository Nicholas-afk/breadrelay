# Verification of the core product

Recorded 6 October 2026 at 01:41:49 HKT (5 October, 17:41:49 UTC). This is prototype evidence, not operator or delivered-food evidence.

- Strict TypeScript and Vite production build: passed after review fixes and source formatting.
- Native Node tests: 7 passed, including 350 independent exhaustive-oracle comparisons of grams / retained assignments / travel.
- Built static site: 24 checks passed in Chrome 154.0.8037.95 under `/breadrelay/`.
- Viewports: desktop1440 px; responsive768,390,320 px, with no horizontal page overflow.
- Cancellation click-to-ready: 82 ms on this run, including automation overhead.
- No unexpected page errors or external runtime requests observed.
- Current download, print context, linked field-error focus, draft preservation, delayed-file reset isolation, worker failure/fallback, timeout/retry and offline-after-load exercised.
- Thirty compiled-worker repetitions at10 pickups/3 volunteers/3 stops: median17.9 ms, p9528.8 ms, max30.8 ms. The measured operation includes all calculation stages and excluded-pickup explanations.

Fresh read-only code review found three important issues (data-kind coercion, print provenance, delayed imports) and one minor issue (unfinished drafts). Each was reproduced and fixed. Data-kind test failed before a strict check and passed afterward. Print/draft regressions showed missing context and a lost25.123 kg edit before fixing; afterward the correct metadata and25.123 persisted. Delayed import reset regression initially changed38 kg to0 kg, and now preserves38.

## Core completion checks — 6 October, 02:07 HKT

The implemented core now has pickup weight/window/service/deadline editing, complete directed travel inspection, report reconstruction, reusable current-round export, actual clipboard copying with selectable-text fallback, dropped-baseline route reasons, and arrival/wait/load details. Native tests13/13 pass, including350 oracle comparisons and hand-checked exact-boundary, non-metric, retention and stable-tie fixtures. The compiled core suite18/18 passes in Chrome154, in addition to the24-check interface suite. The final refreshed evidence is recorded in the project handoff outside the source repository.

Browser checks include a forged report recalculated to38/18/26 kg; invalid pickup edits preserving26; an applied13 kg offer yielding27 with a pinned38 kg reference; report round trips; real clipboard output; injected clipboard/download denial; complete travel cells;320/390 px forms; print provenance; two20-minute shift delays producing0 baseline/27 revised; operator versus sample labels; missing-leg import rejection; full keyboard cancellation/explanation/download; and delayed pickup edits with preserved other drafts.

A meaningful new regression initially rendered a13 kg input on the old26 kg pending route. Accepted results now retain their own input snapshot: that route continues showing12 kg until the revised27 kg plan is ready. Equal-weight explanations now identify assignment retention, travel savings or stable ID order rather than claiming an unsupported cause. Imported plans/totals/claims are ignored; only independently validated same-date/same-ID input pairs are restored.

Limits: supplied fixed travel; before departure only; no real operator or delivered-food evaluation; Chrome-only browser evidence; no comprehensive assistive-technology audit; fresh offline reload not guaranteed; public deployment and competition submission not complete. Download permission may silently suppress a browser download; the full JSON is always exposed when requesting a plan download.
