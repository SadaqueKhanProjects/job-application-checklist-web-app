# Contributing

Use `main` as the integration branch. Track a coherent change in a GitHub issue and use its actual issue number in a semantic branch name:

```text
feature/01-local-application-tracker
chore/03-automated-validation
bugfix/<issue-number>-<short-description>
refactor/<issue-number>-<short-description>
test/<issue-number>-<short-description>
doc/<issue-number>-<short-description>
```

Issue and pull request numbers share GitHub's sequence. Check existing work before choosing a number. Start subsequent branches from updated `main`; avoid unrelated changes and unnecessary branches.

Use focused Conventional Commits, `type(scope): concise imperative description`, such as `feat(ui): add application dashboard` or `test(storage): cover failed writes`. Separate meaningful domain, UI, test and documentation changes when appropriate. Preserve unrelated local work and shared history; do not force-push established branches.

Before opening a PR:

```sh
npm run check
npm test
git diff --check
```

Exercise changed user flows in a browser and distinguish browser evidence from automated or static checks. No install or build command is required while the project has no dependencies or bundling.

Public-repository CI uses standard free runners. If the repository becomes private, verify a hard spending block before enabling GitHub-hosted CI. GitHub Actions for private repositories uses a shared included allowance; if the block cannot be verified, run checks locally and report the blocker instead of triggering a potentially billable workflow. See the [free-only project instructions](AGENTS.md) and [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage).

Push the work branch and open a PR into `main` with a Conventional Commit-style title. Explain what changed, why, architectural decisions, affected areas and actual validation. Reference the work item with `Closes #<issue-number>` when complete. GitHub Actions checks syntax and tests on Node 22 and 24 with read-only permissions. Wait for the actual check results.

Under the owner's authorized AI-agent workflow, merge completed PRs when checks pass and no conflicts, unresolved safety concerns or incomplete work remain. Use a merge commit to preserve focused implementation commits. Then fetch and fast-forward local `main` before the next work item. Do not merge failed, incomplete or materially different work. Branch protection is not configured by these instructions; these are the project's workflow rules, not a claim of an enforced GitHub gate.

Repository delivery does not authorize deployment, publishing a site, paid services or changes to account access. Keep the app browser-only unless the owner requests a product change.
