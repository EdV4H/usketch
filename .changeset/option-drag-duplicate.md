---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-plugin-snap": patch
"@edv4h/usketch-plugin-keyboard-shortcuts": patch
---

feat(tool-select): Option(Alt)+ドラッグで選択図形を複製。ドラッグ中に Option を押す/離すで複製⇔移動を即切替（元はドラッグ開始位置に残り、Undo 1 回で戻る）。「その場に残る側」のプレビューは開始時スナップショットをオーバーレイレイヤーで描き、store・履歴・同期には入れない。

- store: 複製の純関数 `collectWithDescendants` / `connectorsBetween` / `cloneShapes` / `rootShapeIds` / `translateShape` と、複数追加を 1 手にする `createAddShapesCommand` を追加。
- store: `createContainmentAttacher` は、`parentId` 付きで追加された shape の親がまだその shape を含んでいれば付け替えない（Cmd+D / ペーストで複製を元フレームに重ねて置いたとき、同サイズの元フレームへ誤って付け替わり、複製の子がフレームの背面に隠れていた問題の修正）。
- shared: `CoreEventMap` に `snap:alt-toggle-suppress` / `snap:extra-candidates` を追加。
- snap: 公開イベント `snap:alt-toggle-suppress { suppressed }` を追加。`true` の間は Alt でスナップを切り替えない。tool-select は Option+ドラッグ可能な移動ドラッグ中だけ `true` にする。
- snap: 公開イベント `snap:extra-candidates { boxes }` を追加。store に無い一時的なスナップ候補（ワールド座標の矩形）を受け取り、空配列で解除。tool-select は複製中だけ開始位置の矩形を渡し、複製を元と揃えて置けるようにする。
- store: `cloneShapes` は `isEditing` を引き継がない（複製がテキスト編集モードで始まりフォーカスを奪わない）。
- keyboard-shortcuts: Cmd+D / ペーストが frame・group の子孫と、それらを結ぶコネクタも複製し、両端とも複製されたコネクタの `sourceId` / `targetId` を複製先へ張り替えるよう修正。Undo 1 回で全体が戻る。
