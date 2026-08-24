# npm Trusted Publishing (OIDC)

The Release workflow (`.github/workflows/release.yml`) publishes to npm via
**GitHub OIDC trusted publishing** — no long-lived `NPM_TOKEN`. Auth is a
short-lived token minted per job (`permissions: id-token: write`), and npm
auto-generates provenance.

## npmjs.com setup (one-time, per package)

Trusted publishers are configured **per package** (npm has no org/scope-level
setting). For each package below, on npmjs.com → the package's **Settings** →
**Trusted Publisher** → **GitHub Actions**, enter:

| Field | Value |
| --- | --- |
| Organization or user | `EdV4H` |
| Repository | `usketch` |
| Workflow filename | `release.yml` |
| Environment | *(leave blank — the Release job uses no GitHub Environment)* |

New/unpublished packages (e.g. `@edv4h/usketch-plugin-scatter`) can be configured
**before** their first publish.

> Until a package has its trusted publisher configured, `changeset publish` will
> fail for that package. Because a shared-package bump cascades a patch release to
> all dependents, configure **every** package below to keep cascade releases green.

## Publishable packages (89)

```
@edv4h/usketch-canvas-engine
@edv4h/usketch-connector-anchor
@edv4h/usketch-core
@edv4h/usketch-dom-renderer
@edv4h/usketch-gpu-renderer
@edv4h/usketch-map-icons
@edv4h/usketch-plugin-activity-feed
@edv4h/usketch-plugin-ai-actions
@edv4h/usketch-plugin-ai-agent
@edv4h/usketch-plugin-ai-chat
@edv4h/usketch-plugin-ai-copilot
@edv4h/usketch-plugin-ai-image
@edv4h/usketch-plugin-ai-recognize
@edv4h/usketch-plugin-ai-voice
@edv4h/usketch-plugin-asset-store
@edv4h/usketch-plugin-avatar
@edv4h/usketch-plugin-bg-dots
@edv4h/usketch-plugin-bg-grid
@edv4h/usketch-plugin-board-info-panel
@edv4h/usketch-plugin-canvas-filter
@edv4h/usketch-plugin-comments
@edv4h/usketch-plugin-community-chat
@edv4h/usketch-plugin-container
@edv4h/usketch-plugin-debug-hud
@edv4h/usketch-plugin-deep-link
@edv4h/usketch-plugin-domain-design
@edv4h/usketch-plugin-effect-ripple
@edv4h/usketch-plugin-export
@edv4h/usketch-plugin-follow-me
@edv4h/usketch-plugin-free-position
@edv4h/usketch-plugin-keyboard-shortcuts
@edv4h/usketch-plugin-laser
@edv4h/usketch-plugin-map
@edv4h/usketch-plugin-markdown-to-shape
@edv4h/usketch-plugin-portal
@edv4h/usketch-plugin-presence-activity
@edv4h/usketch-plugin-presence-cursor
@edv4h/usketch-plugin-presence-enhanced
@edv4h/usketch-plugin-presentation
@edv4h/usketch-plugin-reactions
@edv4h/usketch-plugin-scatter
@edv4h/usketch-plugin-server-ai
@edv4h/usketch-plugin-server-auth
@edv4h/usketch-plugin-server-boards
@edv4h/usketch-plugin-server-chat
@edv4h/usketch-plugin-server-comments
@edv4h/usketch-plugin-session
@edv4h/usketch-plugin-shape-basic
@edv4h/usketch-plugin-shape-board-portal
@edv4h/usketch-plugin-shape-card
@edv4h/usketch-plugin-shape-community-region
@edv4h/usketch-plugin-shape-connector
@edv4h/usketch-plugin-shape-counter
@edv4h/usketch-plugin-shape-embed
@edv4h/usketch-plugin-shape-frame
@edv4h/usketch-plugin-shape-freedraw
@edv4h/usketch-plugin-shape-group
@edv4h/usketch-plugin-shape-image
@edv4h/usketch-plugin-shape-island
@edv4h/usketch-plugin-shape-markdown
@edv4h/usketch-plugin-shape-openui
@edv4h/usketch-plugin-shape-sticky
@edv4h/usketch-plugin-shape-text
@edv4h/usketch-plugin-shape-wireframe
@edv4h/usketch-plugin-side-panel
@edv4h/usketch-plugin-snap
@edv4h/usketch-plugin-spatial-chat
@edv4h/usketch-plugin-spotlight
@edv4h/usketch-plugin-start-position
@edv4h/usketch-plugin-sync-localstorage-yjs
@edv4h/usketch-plugin-sync-ywebsocket
@edv4h/usketch-plugin-timter
@edv4h/usketch-plugin-tool-openui
@edv4h/usketch-plugin-tool-pan
@edv4h/usketch-plugin-tool-select
@edv4h/usketch-plugin-tool-vim
@edv4h/usketch-plugin-viewport-nav
@edv4h/usketch-plugin-voice-notes
@edv4h/usketch-plugin-voting
@edv4h/usketch-plugin-whistle
@edv4h/usketch-server-core
@edv4h/usketch-session-protocol
@edv4h/usketch-session-voting
@edv4h/usketch-shape-utils
@edv4h/usketch-shared
@edv4h/usketch-store
@edv4h/usketch-sync
@edv4h/usketch-tool-helpers
@edv4h/usketch-ui
```

## Workflow requirements (already in place)

- `permissions.id-token: write` (OIDC), `contents: write`, `pull-requests: write`.
- Node ≥ 22.14 (workflow uses 24) and npm ≥ 11.5.1 (upgraded in the
  "Ensure OIDC-capable npm" step) — required for the CLI to detect OIDC.
- No `NODE_AUTH_TOKEN` / `NPM_TOKEN` in the publish step.

The stale `NPM_TOKEN` secret can be deleted once all packages are on trusted
publishing.
