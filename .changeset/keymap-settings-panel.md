---
"@edv4h/usketch-plugin-key-settings": minor
"@edv4h/usketch-plugin-character": minor
"@edv4h/usketch-core": patch
---

New `@edv4h/usketch-plugin-key-settings`: one HUD "キー設定" panel for every plugin's key bindings (the app's keymap). Bindings are grouped by category (or plugin) with a filter; click a key and press the new one (Esc cancels, Delete / Backspace removes it, "+" adds one). Keys another plugin also uses are marked ⚠ and kept (the keymap's conflict policy decides between them); a key one of the same plugin's other actions had moves over. While picking, the keymap gate blocks every binding. Reset per binding or all at once. The viewer's rebindings are saved through a `KeymapStorage` (default localStorage `"usketch:keymap"`; `storage: false` leaves it to the host). The rules are exported as pure functions (`groupBindings`, `applyPickedKey`, `sharersOf`, `captureKeys`).

Character: its own "キー設定" HUD panel is removed in favour of the shared one. Keys a viewer saved with it (`usketch-plugin-character:keys`) are carried into the keymap once on a host with a keymap (and then saved by the app's key settings); `saveKeys`, `setKeys`'s `save` option, `captureNextKey` and the `character-keys.ts` helpers are deprecated.

Core: `bindKeymapStorage` keeps rebindings made before it was bound (e.g. ones a plugin carried over) and saves them together with the stored ones. `formatKeyCode` tells left / right modifiers apart (`sides`, default `"Left "` / `"Right "`).
