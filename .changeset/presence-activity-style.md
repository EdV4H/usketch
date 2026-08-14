---
"@edv4h/usketch-plugin-presence-activity": minor
---

feat(presence): let the host customize the activity indicators (#960)

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
