# @edv4h/usketch-tool-helpers

## 0.5.0

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

## 0.4.0

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

## 0.3.1

### Patch Changes

- 3e53816: カード / デッキをリサイズ不可（サイズ固定）にできるオプションを追加（#626）。
  - `@edv4h/usketch-plugin-shape-card`:
    - `createCardPlugin({ resizable?: boolean })` — プラグイン全体の既定（既定 `true`）。
    - `CardTypeDefinition.resizable?: boolean` — card-type 単位の指定（プラグイン全体より優先）。「value カードは固定、トランプは可変」のような出し分けが可能。
    - 指定時、`card` / `card-deck` の `ShapeDefinition.resizable` に per-instance で反映される。利用側で `resize` / `applyBounds` を no-op に差し替えるハックが不要になる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.resizable` が `boolean` に加えて述語 `(data) => boolean` を受け付けるようになり、単一 shape type でもインスタンスごとにリサイズ可否を変えられる（後方互換）。判定を一本化する `isShapeResizable(def, shape)` を追加・エクスポート。
  - `@edv4h/usketch-tool-helpers` / `@edv4h/usketch-plugin-tool-select`: リサイズハンドルの当たり判定・カーソル・選択オーバーレイのハンドル表示が `isShapeResizable` 経由で述語形式を尊重するように更新。

- d68e0ca: `findHandleAtScreenPoint` が `ShapeDefinition.resizable: false` を尊重するように修正（#625）。これまでは `resizable:false` でも shape の端でリサイズカーソルに変わり、ドラッグでリサイズ操作が走っていた（選択オーバーレイはハンドル描画を消すだけで、当たり判定・カーソル・操作は止まっていなかった）。回転判定 `findRotationHandleAtScreenPoint` と同じく、`def?.resizable === false` のとき `null` を返すガードを追加。これにより `resizable:false` だけでカーソル・リサイズ操作の両方が無効になり、利用側で `resize`/`applyBounds` を no-op にする回避策が不要になる。
- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-store@3.0.1

## 0.3.0

### Minor Changes

- ae536ff: `findShapeAtPoint` / `trackHover` の `TrackHoverOptions` に `excludeIds` と `filter` を追加（#613）。
  - `excludeIds?: ReadonlySet<string> | readonly string[]` — ヒットテストの走査でスキップするシェイプ id。
  - `filter?: (shape: ShapeData) => boolean` — `false` を返したシェイプをスキップする述語。

  ドラッグ&ドロップで「掴んでいるシェイプの下にあるシェイプへドロップ」する用途で、掴んでいる id（や自分の種別）を除外して「直下の次のシェイプ」を取得できる。既存の精度（precedence）ルールはそのまま。

- 0874a59: `startDragSession` / `collectSelectionWithDescendants` に `followChildrenOf` オプションを追加（#612）。

  これまで移動時に子を追従させるのはコンテナ（group/frame/island）のみだったが、`followChildrenOf?: (shape: ShapeData) => boolean`（既定はコンテナ判定）で、任意の非コンテナ親（例: 任意のシェイプに `parentId` で取り付けたステッカー/リアクション）の子も追従対象にできる。`includeDescendants` が `true`（既定）のときに参照される。

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0

## 0.2.1

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0
  - @edv4h/usketch-store@2.0.1

## 0.2.0

### Minor Changes

- 5db18d6: Issue #576: tool 用の state machine helper を新パッケージ `@edv4h/usketch-tool-helpers`
  に切り出した。

  `plugin-tool-select` 内部で 1000 行超に渡って手書きされていた drag / resize /
  rotate / marquee / hover の state machine を、再利用可能な session API として
  公開する。

  新公開 API:
  - `startDragSession` — 移動 (子孫の自動追従、snap callback、`commit()` で `createMoveShapesCommand` を返却)
  - `startResizeSession` — single + multi の discriminated union。8 方向ハンドル、
    flip 検出、`def.applyBounds()` フック対応
  - `startRotateSession` — atan2 ベースの角度計算、shift で 15° snap、子要素の剛体回転
  - `startMarqueeSession` — intersect / contain（alt 切替）、最小ドラッグ距離フィルタ
  - `trackHover` / `findShapeAtPoint` — handle / shape body の hit-test 純関数
  - 既存の `resize-utils.ts` の関数群（`findHandleAtScreenPoint`、
    `getCursorForHandle`、`computeMultiResizeUpdates` 等）を helper パッケージ
    経由で公開

  `plugin-tool-select` 側は session 呼び出し形式に書き換え済み。挙動・パブリック
  API・undo 履歴は完全互換 (内部リファクタのみ)。

  `@edv4h/usketch-shape-utils` と同じく `@edv4h/usketch-shared` + `@edv4h/usketch-store`
  にしか依存しないので、weboard などの外部リポジトリからもプラグインを介さず
  import できる。

  docs ガイド (英語 / 日本語) に「Reusable Session Helpers」セクションを追加し、
  ドラッグで矩形を描画する最小カスタムツール例を掲載した。

  参照: Issue #576

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-store@2.0.0
