# @edv4h/usketch-plugin-key-settings

## 0.1.1

### Patch Changes

- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0
  - @edv4h/usketch-core@2.6.0

## 0.1.0

### Minor Changes

- 5adf284: New `@edv4h/usketch-plugin-key-settings`: one HUD "キー設定" panel for every plugin's key bindings (the app's keymap). Bindings are grouped by category (or plugin) with a filter; click a key and press the new one (Esc cancels, Delete / Backspace removes it, "+" adds one). Keys another plugin also uses are marked ⚠ and kept (the keymap's conflict policy decides between them); a key one of the same plugin's other actions had moves over. While picking, the keymap gate blocks every binding. Reset per binding or all at once. The viewer's rebindings are saved through a `KeymapStorage` (default localStorage `"usketch:keymap"`; `storage: false` leaves it to the host). The rules are exported as pure functions (`groupBindings`, `applyPickedKey`, `sharersOf`, `captureKeys`).
  
  Character: its own "キー設定" HUD panel is removed in favour of the shared one. Keys a viewer saved with it (`usketch-plugin-character:keys`) are carried into the keymap once on a host with a keymap (and then saved by the app's key settings); `saveKeys`, `setKeys`'s `save` option, `captureNextKey` and the `character-keys.ts` helpers are deprecated.
  
  Core: `bindKeymapStorage` keeps rebindings made before it was bound (e.g. ones a plugin carried over) and saves them together with the stored ones. `formatKeyCode` tells left / right modifiers apart (`sides`, default `"Left "` / `"Right "`).

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
- Updated dependencies [5adf284]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-core@2.5.0
