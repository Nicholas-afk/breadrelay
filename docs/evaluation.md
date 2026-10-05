# Verification of the implemented main interface

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

Limits: synthetic fixed travel; before departure only; no real operator evaluation; Chrome-only browser evidence; no comprehensive assistive-technology audit; scenario-file import only; downloadable reports are not reimportable; fresh offline reload not guaranteed; public deployment and competition submission not complete.
