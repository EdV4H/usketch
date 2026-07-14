---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-attachable": minor
---

任意 shape に貼り付いて追従する「アタッチ可能な子」shape をネイティブ対応（#660）。container 機構（親側 opt-in）の逆方向として、child 側で opt-in する `attachable` 宣言を追加。付箋・カードなど非コンテナ shape にも乗せると貼り付き、親移動に追従する。bespoke なドラッグ乗っ取りが不要になり、素の select tool 由来の選択・リサイズ・回転を保てる。

- `@edv4h/usketch-shared`: `ShapeDefinition.attachable?: { toAny?, follow?, hitTest? }` を追加（`container` と対になる child 側宣言。各値は `boolean | ((data) => boolean)` 述語形）。評価ヘルパー `isAttachable` / `isAttachableFollow` / `getAttachableHitTest` / `attachableAcceptsTarget` を追加。
- `@edv4h/usketch-tool-helpers`: `collectSelectionWithDescendants` を拡張し、親が非コンテナでも `attachable.follow` を宣言した子は親移動に追従（native move-follow の child 側 opt-in、プラグイン不要）。attachable shape が無いボードでは挙動・コスト共に従来と同一。
- `@edv4h/usketch-store`: child 主導の reactive attach util `createAttachableAttacher` を追加（`shapes:move-end` を購読し、`hitTest`（center/contain）と `toAny` フィルタで front-most な対象に parentId を付与/解除、循環ガード・undo 対応）。`createContainmentAttacher` は不変。
- `@edv4h/usketch-plugin-attachable`（新規）: `attachable` を宣言した shape の attach-on-drop を `createAttachableAttacher` で駆動。follow はプラグイン無しでも native に効き、attach を使うアプリがこのプラグインを register する。
