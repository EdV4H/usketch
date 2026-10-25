---
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-plugin-snap": minor
"@edv4h/usketch-plugin-keyboard-shortcuts": patch
---

feat(tool-select): Option(Alt)+ドラッグで選択図形を複製（Figma と同じく元はその場に残り、複製が動く）。ドラッグ中に Option を押す/離すで複製⇔移動を即切替。ドラッグ中の複製は履歴なしで store に入れて動かすので、共同編集の相手にも複製が動いて見える。ドロップで 1 つの追加コマンドに置き換え、Undo / Redo とも 1 手。動かさずに離したら複製しない。

- **snap（挙動の変更）**: スナップを一時的に切り替えるキーを Alt(Option) から **Ctrl / Cmd** に変更（Alt は複製に使うため）。`altBehavior` オプションは名前を変えずに Ctrl / Cmd の挙動を指定する。
- tool-select: 複製の純関数 `addDragCopies` / `commitDragCopies` / `removeDragCopies` / `resolveCopyParents` / `duplicateTargetIds` を export。複製の親（フレームへの出し入れ）は containment-attacher と同じ規則で先に決め、追加時に別の reparent が履歴に積まれないようにした。ドラッグ中の Alt キーは preventDefault する（Windows でメニューバーにフォーカスが移らないように）。
- store: 複製の純関数 `collectWithDescendants` / `connectorsBetween` / `cloneShapes` / `rootShapeIds` / `translateShape`、複数追加を 1 手にする `createAddShapesCommand`、attacher と同じ親の決め方 `findAttachParent` を追加。
- store: `createContainmentAttacher` は、`parentId` 付きで追加された shape の親を保つ（フレームはまだその shape を含んでいれば、グループは常に）。Cmd+D / ペーストで複製を元フレームに重ねて置いたときに元フレームへ誤って付け替わる問題と、グループの複製で子がグループから外れる問題の修正。
- store: `cloneShapes` は `isEditing` を引き継がない（複製がテキスト編集モードで始まりフォーカスを奪わない）。
- keyboard-shortcuts: Cmd+D / ペーストが frame・group の子孫と、それらを結ぶコネクタも複製し、両端とも複製されたコネクタの `sourceId` / `targetId` を複製先へ張り替えるよう修正。Undo 1 回で全体が戻る。確定後は複製元で選択していた図形の複製だけを選択する（間のコネクタは選択しない）。
