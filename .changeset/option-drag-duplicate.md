---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-plugin-snap": patch
"@edv4h/usketch-plugin-keyboard-shortcuts": patch
---

feat(tool-select): Option(Alt)+ドラッグで選択図形を複製。ドラッグ中に Option を押す/離すで複製⇔移動を即切替（元はドラッグ開始位置に残り、Undo 1 回で戻る）。

- store: 複製の純関数 `collectWithDescendants` / `connectorsBetween` / `cloneShapes` / `rootShapeIds` / `translateShape` と、複数追加を 1 手にする `createAddShapesCommand` を追加。
- store: `createContainmentAttacher` は、`parentId` 付きで追加された shape の親がまだその shape を含んでいれば付け替えない（同サイズの元フレームへ誤って付け替わり、複製の子がフレームの背面に隠れていた問題の修正）。
- shared: `CoreEventMap` に `shapes:move-start` を追加。
- snap: 選択の移動ドラッグ中は Alt でスナップを解除しない（Alt は複製に使う）。
- keyboard-shortcuts: Cmd+D / ペーストが frame・group の子孫と、それらを結ぶコネクタも複製し、両端とも複製されたコネクタの `sourceId` / `targetId` を複製先へ張り替えるよう修正。Undo 1 回で全体が戻る。
