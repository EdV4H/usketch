---
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-tool-select": minor
---

feat: フレーム（など子を持つ図形）を削除するとき、中身ごと削除するか、フレームだけ削除して中身を残すかを選べるようにした。ロックの「中身ごとロック / フレームだけロック」（`lockScope: "self"`）と同じ設計。削除・ロックのキー割り当てはホストから変更できる。

- store: `createDeleteShapesCommand(store, shapeIds, scope?)` を追加。`createSetLockedCommand` と同じく `scope: "self"` で自分だけに効く（子は削除した図形の親に付け替わり、位置はそのまま）。複数図形の削除が 1 回の Undo で戻るようにもなった。
- tool-select: 既定のキーは Delete / Backspace = 中身ごと削除、Shift+Delete / Shift+Backspace = フレームだけ削除、Mod+Shift+L = ロック切替（中身ごと）。フレームだけロックは既定では割り当てなし。
- tool-select: `createSelectToolPlugin({ keybindings })` で `delete` / `deleteSelf` / `toggleLock` / `toggleLockSelf` のキーを差し替え・無効化できる（既定値は `DEFAULT_SELECT_TOOL_KEYBINDINGS`）。
- tool-select: ホストのツールバー向けに純関数 `createDeleteSelectionCommand(store, scope?)`（ロック・非表示の図形は除外）と `createToggleLockSelectionCommand(store, scope?)`（全部同じ scope でロック済みなら解除、それ以外はロック）を公開。
- tool-select: プラグイン破棄時に削除キーの登録を解除するようにした。
