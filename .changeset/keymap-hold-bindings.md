---
"@edv4h/usketch-plugin-character": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-window-system": minor
---

Character, Mode 7 and window-system keys are now keymap bindings (`ctx.keymap`), so overlaps with other plugins show up in `keymap.getConflicts()` and hosts can set them with `createApp({ keymap: { keys } })`.

- Character: the movement, drift and jump keys are `"hold"` bindings (`CHARACTER_KEY_IDS`, e.g. `usketch-plugin-character:jump`), with the plugin's `keys` as defaults. While the character is on they sit above tool shortcuts and Mode 7's camera height keys (`CHARACTER_KEY_PRIORITY`: movement, then drift, then jump), and a key the keymap gives to someone else is left alone. `setKeys` / `resetKeys` / `getDefaultKeys` / `onKeysChange` now go through the keymap (a viewer's saved keys are applied on top of the host's), so rebinding in the keymap updates the HUD's key settings too.
- Mode 7: the camera height keys are `"hold"` bindings `HEIGHT_KEY_IDS` (`usketch-plugin-mode7:camera-up` / `camera-down`, priority `HEIGHT_KEY_PRIORITY` = 10) that only count while the 3D view is on and no follower drives the height. `getHeightKeys` / `setHeightKeys` are deprecated wrappers. Every action is a binding `usketch-plugin-mode7:<action>` (no keys by default); the `shortcuts` option is deprecated.
- Window system: every action is a binding `usketch-plugin-window-system:<action>`, taking its keys (default `Alt+Arrow` / `Alt+Shift+Arrow`) only on a window board; the `shortcuts` option is deprecated.

Hosts without a keymap (older `@edv4h/usketch-core`) keep the previous behaviour.
