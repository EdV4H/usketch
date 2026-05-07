---
"@edv4h/usketch-plugin-sync-ywebsocket": minor
"@edv4h/usketch-plugin-debug-hud": minor
---

サーバ未同期 Shape を UI で警告できるようにした。

`SyncStatusTracker` に `unconfirmedShapeIds: readonly string[]` を追加し、
`provider.on("sync")` 時にサーバが認識している shape ID 集合を確定スナップショット
として記録。以降、ローカル側のみで `shape:added` された (= サーバから来ていない、
あるいは IndexedDB に残っていただけの) shape は「未確定」として識別される。

UI の表示先:

- ywebsocket plugin が新しい canvas overlay (`unconfirmed-shapes-overlay`,
  layer order 250) を register。未確定 shape の右上に小さな赤い `!` バッジを
  描画 (pointer events 無効、診断のみ)。
- debug HUD の General パネルに「⚠ サーバ未同期 Shape: N 件」行を追加。
- debug HUD の Shapes パネルで各行に「⚠ 未同期」バッジを表示。ヘッダの件数
  バッジをクリックすると未同期のみフィルタ。

ywebsocket plugin が組まれていない (IndexedDB-only) ボードでは何も表示されない。
