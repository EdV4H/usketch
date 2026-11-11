---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
---

Add `ctx.keymap` / `app.keymap`: one registry for every key binding, with overlap detection and rebinding. `ctx.shortcuts.register` and `ToolDefinition.shortcut` now register `"press"` bindings in it (attributed to the calling plugin), and plugins can declare `"hold"` keys (`KeyboardEvent.code`s) that they keep handling themselves, checking `keymap.claims(id, event)` first. When several bindings act on one key, the one whose `when()` holds wins, then the higher `priority`, then the plugin listed first in `createApp({ plugins })`. `keymap.getConflicts()` lists the overlaps, and `createApp({ keymap: { warnConflicts: true } })` warns about them at startup. Hosts can replace defaults with `createApp({ keymap: { keys } })`, and viewers can rebind with `keymap.setKeys` / `resetKeys` (persist `getOverrides()` and pass it back as `keymap.overrides`).

Behavior change: two plugins that register the same shortcut no longer overwrite each other (the later one used to win silently); both stay registered and the ranking above decides. Fixes: tool shortcuts now ignore Shift chords, so `Shift+S` (shuffle deck) no longer switches to the sticky-note tool; unregistering a shortcut that another registration with the same combo had replaced no longer removes the newer one.
