# Attribution and provenance

OpenAI Codex contributed substantially to research, planning, design, implementation, testing, review and documentation. See [AI_DISCLOSURE.md](../AI_DISCLOSURE.md). The running product uses a deterministic planner and does not call a model API. No undisclosed model or external service is credited as a working integration.

The source, illustrative fixture, SVG bread mark and interface were created for this project with that assistance. The sample's bakery/volunteer labels, weights, windows and travel minutes are fictional. The generated evaluation corpus is synthetic too; it is not an operator dataset or an observed food-rescue result.

Problem research used [Feeding Hong Kong's Bread Run](https://feedinghk.org/bread-runner/). Prior-art research used [Food Rescue Hero's multi-stop workflow](https://foodrescuehero.org/introducing-multi-stop-rescues/) and [Google OR-Tools routing documentation](https://developers.google.com/optimization/routing/vrptw). These sources informed the problem and comparison; BreadRelay does not claim their endorsement, affiliation or copied operational data. Routing with time windows is established prior art, not a claimed new algorithm.

The design adapted general hierarchy, task focus and native control principles from the documented research. No reference brand asset, layout, remote photograph, downloaded icon set or external font is included. The interface uses system fonts and its project-created SVG mark.

TypeScript, Vite and their locked dependencies build the app. Playwright controls browser verification; Node runs tests. Native browser APIs provide workers, downloads, clipboard and print. The Vite-generated module-preload helper retains its MIT notice in the static release. See [dependency-licenses.md](dependency-licenses.md) and [LICENSE.md](../LICENSE.md) for licensing boundaries.
