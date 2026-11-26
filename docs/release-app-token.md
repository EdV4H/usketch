# Release PR token (GitHub App)

The Release workflow (`.github/workflows/release.yml`) opens and updates the
"🎉 release: Version Packages" PR. If it does that with the default
`GITHUB_TOKEN`, GitHub creates the PR's `pull_request` workflow runs (CI, Check
Filename Convention) in an **approval-required** state, and someone has to press
**Approve and run** on every release PR. GitHub's docs give one way out: create
the PR with a GitHub App installation token (or a PAT) instead of `GITHUB_TOKEN`.
No repository Actions setting turns this off.

The workflow therefore mints a short-lived token for a small GitHub App with
[`actions/create-github-app-token`](https://github.com/actions/create-github-app-token)
and passes it to `changesets/action` as `github-token`. The release PR is then
authored and pushed by the app (like Renovate's PRs), and CI starts by itself.

If the variable below is not set, the token step is skipped and the workflow
falls back to `GITHUB_TOKEN` (the old behaviour, with manual approval).

## One-time setup

1. Create the app: <https://github.com/settings/apps/new>
   - **GitHub App name**: anything unique, e.g. `usketch-release`
   - **Homepage URL**: `https://github.com/EdV4H/usketch`
   - **Webhook**: untick **Active** (no webhook needed)
   - **Repository permissions**: **Contents** → Read and write,
     **Pull requests** → Read and write (Metadata: read-only is added automatically)
   - **Where can this GitHub App be installed?**: Only on this account
2. On the app's page, copy the **Client ID**, then under **Private keys** click
   **Generate a private key** (a `.pem` file downloads).
3. **Install App** (left menu) → install on `EdV4H` → **Only select
   repositories** → `usketch`.
4. In the repo, **Settings → Secrets and variables → Actions**:
   - **Variables** tab → `RELEASE_APP_CLIENT_ID` = the Client ID
   - **Secrets** tab → `RELEASE_APP_PRIVATE_KEY` = the whole `.pem` file content
     (including the `-----BEGIN ... KEY-----` lines)

The next push to `main` that leaves changesets pending updates the release PR
with the app token. Its CI should start without the approval banner.

## Notes

- The token lasts one hour and only has Contents + Pull requests write on this
  repository. npm publishing still uses OIDC trusted publishing and is unchanged.
- The tag and GitHub Release reconcile steps keep using `GITHUB_TOKEN`; tag pushes
  do not trigger any workflow here.
- To rotate the key, generate a new private key on the app page, update the
  secret, then delete the old key.
