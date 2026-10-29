# GitHub Pages hosting

## Status

The owner approved making the repository and its history public. The repository is now public; activation and live verification are in progress.

## Free setup

Use GitHub Free, a public repository, standard `ubuntu-latest` runners and the included `github.io` address. No custom domain purchase or subscription is needed. CI jobs skip private repositories. Deployment additionally requires `PAGES_ENABLED=true` and the `main` branch.

The workflow publishes a generated `gh-pages` branch and explicitly requests a Pages build through GitHub's REST API. It uses no uploaded Actions artifacts, caches, larger runners or paid external services. This avoids relying on shared artifact-storage allowance. GitHub's platform limits still apply; limits may stop builds or serving rather than provide unlimited capacity.

## Activation after approval

1. Review tracked files, history, screenshots and commit metadata for material that must stay private. Publishing the source exposes history as well as the website code.
2. Make this repository public only after explicit owner approval.
3. Complete the pending UI, Excel export and hosting PRs in dependency order. Use their local test results and public-repository CI; do not run the older private workflows before the visibility change.
4. Create `gh-pages` from only the contents of `npm run build:site` output (`.site/`), including `.nojekyll`. Do not copy the working directory wholesale.
5. Configure Pages to deploy from the `gh-pages` branch root (`build_type: legacy`). Enable HTTPS.
6. Configure the `github-pages` environment to allow deployment from `main` and `gh-pages` (the branch used by the Pages build). Set repository Actions variable `PAGES_ENABLED=true`.
7. Run **Publish website** on `main`. Verify that the Pages build completes for the generated commit and check the returned URL, including screenshot OCR, Excel export and offline assets.

Expected address after activation: `https://SadaqueKhanProjects.github.io/job-application-checklist-web-app/`. This is not yet a confirmed live URL.

## Pipeline

Pull requests into main run JavaScript syntax checks, the test suite and patch checks on Node 22 and 24. Main deployments repeat checks on Node 24, build an allowlisted static directory, update `gh-pages` without rewriting history, and request a Pages build. Failed checks prevent publication. Deployments are serialized; only main can publish. Tokens have repository-scoped permissions; no personal token is stored.

To roll back, revert the relevant source commit through a PR and merge it; the pipeline republishes the earlier code. Turn off `PAGES_ENABLED` to pause future deployments. Existing hosted files remain live until Pages is disabled.

## Data

Application records remain in each browser's localStorage. The host receives ordinary website requests, not application records or OCR screenshots. GitHub may retain access logs. The localhost and hosted origins have separate data, and no import or sync is implemented. Keep the existing JSON/Excel exports before moving; deploying the app does not migrate records.

## Sources

- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Pages build API](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build)
