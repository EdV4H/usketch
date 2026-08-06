# @edv4h/usketch-plugin-container

## 0.3.7

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-store@3.5.2

## 0.3.6

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 0.3.5

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 0.3.4

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 0.3.3

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-store@3.3.1

## 0.3.1

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0

## 0.3.0

### Minor Changes

- 05b6e0b: 任意 shape に貼り付いて追従する「アタッチ可能な子」shape をネイティブ対応（#660）。container 機構（親側 opt-in）の逆方向として、child 側で opt-in する `attachable` 宣言を追加。付箋・カードなど非コンテナ shape にも乗せると貼り付き、親移動に追従する。bespoke なドラッグ乗っ取りが不要になり、素の select tool 由来の選択・リサイズ・回転を保てる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.attachable?: { toAny?, follow?, hitTest? }` を追加（`container` と対になる child 側宣言。各値は `boolean | ((data) => boolean)` 述語形）。評価ヘルパー `isAttachable` / `isAttachableFollow` / `getAttachableHitTest` / `attachableAcceptsTarget` を追加。
  - `@edv4h/usketch-tool-helpers`: `collectSelectionWithDescendants` を拡張し、親が非コンテナでも `attachable.follow` を宣言した子は親移動に追従（native move-follow の child 側 opt-in、プラグイン不要）。attachable shape が無いボードでは挙動・コスト共に従来と同一。
  - `@edv4h/usketch-store`: child 主導の reactive attach util `createAttachableAttacher` を追加（`shapes:move-end` を購読し、`hitTest`（center/contain）と `toAny` フィルタで front-most な対象に parentId を付与/解除、循環ガード・undo 対応）。`createContainmentAttacher` は不変。
  - `@edv4h/usketch-plugin-container`: `createAttachablePlugin()` を追加（同 subsystem のため専用パッケージではなく本プラグインから export）。`attachable` を宣言した shape の attach-on-drop を `createAttachableAttacher` で駆動する独立プラグイン（`createContainerPlugin` とは別に register 可能）。follow はプラグイン無しでも native に効き、attach を使うアプリがこの `createAttachablePlugin()` を register する。

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-store@3.2.0

## 0.2.0

### Minor Changes

- 8d341b3: コンテナ機構を type 文字列のハードコードからフラグ駆動に開放し、独自コンテナ型シェイプを可能にした（#647）。
  - `@edv4h/usketch-shared`: `ShapeDefinition.container?: { enabled?, selectableChildren?, autoAttach?, layout? }` を追加（各値は `resizable` 同様の `boolean | ((data) => boolean)` 述語形）。評価ヘルパー `isShapeContainer` / `hasSelectableChildren` / `isContainerAutoAttach` / `getContainerLayout` を追加。
  - `@edv4h/usketch-tool-helpers`: `findShapeAtPoint` / marquee / descendant collection の `frame`/`island`/`group` 型ハードコードを撤廃し、`container` フラグ駆動に。frame/island 相当の子は個別選択、group 相当は親ごと選択。
  - `@edv4h/usketch-store`: 汎用 `createContainmentAttacher`（重なりで parentId 付与/解除、循環ガード、undo 対応）を追加。`createCollisionWatcher` に `isContainer` 述語オプションを追加。
  - `@edv4h/usketch-plugin-snap`: `SnapSettings.excludeTargets`（`snap:configure` 経由）を追加。該当シェイプは吸着先候補からも被スナップからも除外。
  - `@edv4h/usketch-plugin-container`（新規）: `container` 定義を持つシェイプのアタッチ・整列（`container.layout`、`stackLayout`/`gridLayout` 同梱）・スナップ除外を `onMutation`/イベントで駆動。
  - `@edv4h/usketch-plugin-shape-frame`: `container: { selectableChildren: true, autoAttach: true }` を付与し、独自の `autoReparent` を撤去して container プラグインの共有アタッチャに一本化。
  - `@edv4h/usketch-plugin-shape-group` / `@edv4h/usketch-plugin-shape-island`: `container` を付与（後方互換。group は selectableChildren なし＝従来の親ごと選択、island は selectableChildren あり）。

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0
