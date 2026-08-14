---
"@edv4h/usketch-plugin-presence-activity": minor
---

feat(presence): show the in-app AI agent's edits as a participant (#960)

The ⌘K AI agent writes shapes server-side and has no awareness presence of its own,
so the plugin now mirrors its `ai:response` (the shapes it placed) into a local
`aiActivityStore` and draws them as a synthetic "AI 🤖" participant on the initiating
tab — the same outline/badge/pulse used for remote participants. Cleared after a
short hold, or immediately on `ai:status: "error"`. Exposes `aiActivityStore` for
hosts that want to drive it directly.
