# Bounded scheduling and verification

Every volunteer begins at the hub, collects at most three whole offers, and returns there. Arrival can require waiting until the offer is ready. Collection must finish by closing. Accumulated grams cannot exceed carrying capacity. The return must precede the shift end and every carried offer's hub deadline. Directed times may differ in either direction and need not satisfy a triangle inequality.

For each available volunteer, enumerate every sequence of up to three distinct pickups. Keep the shortest-travel valid sequence per pickup subset; break equal travel by ordered IDs. Explore prefixes even when their direct return is invalid, because a subsequent stop can shorten a non-metric return leg.

Combine disjoint subsets through dynamic programming over volunteers sorted by ID. Compare total scheduled grams, then count of pickup-to-volunteer assignments retained from the pinned starting plan, then total travel minutes, then a stable ID key. An empty plan is feasible. A requested forced pickup can be infeasible. This objective does not estimate spoilage, nutrition, fairness, emissions or actual delivery.

Re-simulate each starting route under the changed inputs, retaining its original order. Drop the whole route if the volunteer is unavailable or the route is no longer valid. That is the unchanged-route comparison. The revised plan is optimized under the same changed inputs.

An excluded pickup is solved again under a forced-inclusion constraint. Display infeasibility, a lower scheduled total, or equal total with secondary-objective differences. The alternative is explanatory and does not silently replace the chosen plan.

`validate-plan.ts` independently reconstructs all timing, load and total fields; it does not invoke the route simulator. The test-only oracle independently enumerates assignments and permutations, rather than invoking the production optimizer.

The browser terminates old workers on each revision and accepts only its current revision. Pending/error results are labelled last checked and cannot be exported as current. Worker startup failure falls back to the same bounded local calculation; a genuine five-second timeout remains an error with retry.
