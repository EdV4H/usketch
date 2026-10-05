# @edv4h/usketch-plugin-presence-activity

## 0.3.3

### Patch Changes

- f4b7387: Keep overlays aligned under camera rotation.
  - shared / canvas-engine: new `Layer.worldOverlay` for fixed layers that draw
    world-anchored things in screen px. Under rotation the canvas turns such a layer
    with the world (about the world origin on screen) and renders it with an
    unrotated viewport, so existing `zoom·w + (x, y)` math stays correct unchanged.
    Helpers: `unrotatedViewport`, `screenToOverlay`, `overlayFrameStyle`. The
    selection foreground is a world overlay by default
    (`SelectionForeground.worldOverlay`).
  - tool-helpers: resize/rotation handle hit tests compare in the same overlay frame,
    so handles can be grabbed where they're drawn.
  - bg-grid: the grid turns with the camera (a diagonal-sized square rotated about
    the screen center, phased onto world multiples).
  - snap, presence-activity, tool-vim, shape-freedraw, shape-connector,
    sync-ywebsocket, comments, shape-frame: their board-anchored overlays opt into
    `worldOverlay`; snap's visible-candidate area is rotation-aware.

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0

## 0.3.2

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0

## 0.3.1

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0

## 0.3.0

### Minor Changes

- b47ae59: feat(presence): let the host customize the activity indicators (#960)

  `createPresenceActivityPlugin` now takes an optional `style` — the integrating app
  can restyle the selection/edit indicators without forking the plugin:
  - `outline` (strokeWidth / padding / radius / opacity / pulse),
  - `marquee` (fillOpacity / strokeWidth / dash),
  - `badge` (enabled / editingSuffix / fontSize / fontWeight),
  - `aiParticipant` (label / color of the local in-app AI participant),
  - `renderParticipant(participant, viewport)` — a full escape hatch returning custom
    SVG (or `null` to draw nothing).

  Everything merges over the defaults, so omitting `style` keeps the stock look.
  Exports `PresenceActivityStyle`, `PresenceParticipant`, `ResolvedActivityStyle`,
  `DEFAULT_ACTIVITY_STYLE`, and `resolveActivityStyle`.

## 0.2.0

### Minor Changes

- dcd49a4: feat(presence): show the in-app AI agent's edits as a participant (#960)

  The ⌘K AI agent writes shapes server-side and has no awareness presence of its own,
  so the plugin now mirrors its `ai:response` (the shapes it placed) into a local
  `aiActivityStore` and draws them as a synthetic "AI 🤖" participant on the initiating
  tab — the same outline/badge/pulse used for remote participants. Cleared after a
  short hold, or immediately on `ai:status: "error"`. Exposes `aiActivityStore` for
  hosts that want to drive it directly.

- 44a679e: feat(presence): show every participant's live selection on the canvas (#960, foundation)

  Adds a general multiplayer "activity" presence channel so you can see what other
  participants are selecting/editing — the foundation for making AI edits feel
  collaborative.
  - New `@edv4h/usketch-plugin-presence-activity`: a canvas overlay that reads the
    Yjs awareness `activity` field (`{ shapeIds?, marquee?, action }`) for every
    remote participant and outlines their selected/edited shapes in the participant's
    presence color, with a name badge and an "editing" pulse. It's actor-agnostic —
    humans and the AI participant are drawn identically (the AI is just a participant
    whose `user.name` is "AI"); no `kind`/`isAi` discriminator.
  - `presence-cursor` now publishes the local selection to that `activity` field, so
    remote selection — previously never rendered — is visible to everyone.

  Cursors and the Members list already came free from `presence-cursor` /
  `presence-store`; this only adds the selection/edit outlines. Drivers that make the
  AI a participant (MCP client, in-app AI agent) build on this in follow-ups.

### Patch Changes

- Updated dependencies [06f3ef8]
  - @edv4h/usketch-sync@1.3.0
