# @edv4h/usketch-plugin-presence-activity

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
