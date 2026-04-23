# Branch protection — setup checklist

GitHub branch-protection rules can't be committed to the repo; they live in repo settings. Apply this checklist **after** pushing the repo for the first time.

Go to **Settings → Branches → Add rule** (or use the *Rulesets* UI, which is the successor — both work).

## Rule: `main`

### Required status checks before merging

- [x] **Require status checks to pass**
- [x] **Require branches to be up to date before merging**
- Required checks (tick these after the first CI run so the names populate):
  - `ci / typecheck · lint · test`

### Pull request reviews

- [x] **Require a pull request before merging**
- [x] **Require approvals** → `1`
- [x] **Dismiss stale pull-request approvals when new commits are pushed**
- [ ] **Require review from Code Owners** — enable once `.github/CODEOWNERS` is added

### Other guards

- [x] **Require conversation resolution before merging**
- [x] **Require signed commits** *(optional but recommended — only turn on once you're comfortable signing)*
- [x] **Require linear history** — disallow merge commits; PRs rebase or squash
- [x] **Do not allow bypassing the above settings** — applies to admins too
- [x] **Restrict who can push to matching branches** → only maintainers
- [x] **Restrict force-pushes** → nobody
- [x] **Restrict deletions** → nobody

## Environments → `production`

The `deploy-server.yml` workflow attaches to this environment. Configure it at **Settings → Environments → New environment → `production`**:

- **Required reviewers:** add yourself (or the maintainer group). Every deploy will wait on a manual approval click — safer than full auto-deploy while the project is solo-maintained.
- **Deployment branches:** `Selected branches` → only `main`.
- **Secrets:**
  - `FLY_API_TOKEN` — from `fly auth token`

If you'd rather deploy without manual approval later, just remove the required reviewer. The workflow itself doesn't change.

## Dependabot

Enable at **Settings → Code security → Dependabot**:

- [x] **Dependabot alerts**
- [x] **Dependabot security updates**
- [x] **Dependabot version updates** — driven by `.github/dependabot.yml` already in the repo

## Secret scanning & push protection

Enable at **Settings → Code security**:

- [x] **Secret scanning**
- [x] **Push protection** — blocks pushes that contain detected secrets before they hit the remote. This is the single highest-value control for a repo going public.

## CODEOWNERS (optional, recommended)

Add `.github/CODEOWNERS` once you have collaborators. For a solo repo it's redundant.

```
# Example
*                    @debdutsaha
/apps/server/        @debdutsaha
/apps/mobile/        @debdutsaha
/packages/contracts/ @debdutsaha
```

## First-push order of operations

1. `git push -u origin main` (or push the initial branch and open a PR).
2. Wait for the first CI run to finish so the `ci / typecheck · lint · test` check name registers.
3. Apply this branch-protection rule.
4. Create the `production` environment and add `FLY_API_TOKEN`.
5. Enable secret scanning + push protection.
6. Merge a tiny throwaway PR to verify the gates actually block unreviewed merges.
