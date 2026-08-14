---
"@edv4h/usketch-plugin-presence-activity": minor
"@edv4h/usketch-plugin-presence-cursor": minor
---

feat(presence): show every participant's live selection on the canvas (#960, foundation)

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
