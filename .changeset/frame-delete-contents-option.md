---
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-tool-select": minor
---

feat: フレーム（など子を持つ図形）を削除するとき、中身ごと削除するか、フレームだけ削除して中身を残すかを選べるようにした。ロックの「中身ごとロック / フレームだけロック」（`lockScope: "self"`）と同じ設計。

- store: `createDeleteShapesCommand(store, shapeIds, scope?)` を追加。`createSetLockedCommand` と同じく `scope: "self"` で自分だけに効く（子は削除した図形の親に付け替わり、位置はそのまま）。複数図形の削除が 1 回の Undo で戻るようにもなった。
- tool-select: Delete / Backspace は従来どおり中身ごと削除、Shift+Delete / Shift+Backspace でフレームだけ削除。ホストのツールバー向けに純関数 `createDeleteSelectionCommand(store, scope?)`（ロック・非表示の図形は除外）を公開。
