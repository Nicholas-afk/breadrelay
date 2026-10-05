# Static release and rollback

The source repository is https://github.com/Nicholas-afk/breadrelay. GitHub Pages serves https://nicholas-afk.github.io/breadrelay/ from the root of the compiled `gh-pages` branch. It contains only the built HTML/CSS/JavaScript, `.nojekyll`, and a `release.json` recording the source commit and asset hashes. This is branch publication, not a custom CI build. Source `main` does not run a server or store a browser API secret.

Before publishing, commit source changes and run:

```sh
npm ci
npm test
npm run build
npm run check:browser
npm run check:improvements
npm run check:webkit
```

The WebKit check needs `npx playwright install webkit`. Chrome setup is described in README. Keep browser artifacts outside the published files. Review any failure before replacing the public branch.

Publish only a fresh copy of `dist/` plus the release metadata, in a separate checkout/index. Preserve the previous deployment commit as the new commit's parent; use an ordinary fast-forward push. Configure Pages with source branch `gh-pages`, path `/`, build type `legacy`. This uses GitHub's branch publishing service; custom workflow permissions are not required. See [official configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) and [Pages API](https://docs.github.com/en/rest/pages/pages).

Wait for the actual Pages build to finish, then fetch every asset and compare SHA-256 with the release metadata. Run the real HTTPS journey:

```sh
BREADRELAY_BASE_URL=https://nicholas-afk.github.io/breadrelay/ npm run check:improvements
```

Check direct refresh, worker loading, current report download and phone layout. A successful push or a Pages configuration response is not sufficient deployment evidence. `release.json` gives the exact deployed source commit; source-only documentation updates can leave the app bytes unchanged.

For rollback, keep the previous verified build and metadata together. Make a new `gh-pages` commit whose contents are that saved release; do not reset source `main` or force-push history. Verify the rolled-back public hashes and journey again. The pre-improvement source commit is tagged `core-20261006-9c8cbb3`.

Limits: initial load needs connectivity; an already-loaded app can calculate without it. Fresh offline reload is unverified. GitHub Pages availability is a hosting dependency. Reports contain supplied input data, so the static site itself is not a storage service. Public prototype hosting does not establish hackathon eligibility or submission status.
