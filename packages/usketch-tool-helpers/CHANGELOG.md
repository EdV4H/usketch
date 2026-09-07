# @edv4h/usketch-tool-helpers

## 0.7.4

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0

## 0.7.3

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-store@3.5.4

## 0.7.2

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-store@3.5.3

## 0.7.1

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-store@3.5.2

## 0.7.0

### Minor Changes

- bba174a: 回転まわりの選択 UI を修正。
  - **複数選択したシェイプを回転できるようにした**。従来は回転ハンドルの検出が単一選択限定で、複数選択（グループ化していない選択）は回転できなかった。複数選択のバウンディングボックスの角外側に回転ゾーンを追加し、選択中の全シェイプを共通中心まわりに剛体回転する `startMultiRotateSession` を追加（コネクタは端点回転、undo/redo 対応）。ホバー時は回転カーソルも出る。
  - **図形のコネクタ・アンカーハンドル（上下左右）が図形の回転に追従するようにした**。従来は回転した図形でもアンカー（コネクタの始点/接続点）が軸平行の辺の中点に出ていて、辺から外れていた。`getAnchorPoint` / `clampToShapeEdge` を回転対応にし（ローカル座標で計算 → 中心まわりに回転して world 座標へ）、選択時の外側オフセットも辺の法線方向へ回すようにした。これで回転済み図形からも正しい辺の位置でコネクタを繋げられる。
  - **グループ回転でコネクタが崩れる不具合を修正**。コネクタは形状を端点（絶対座標）で定義するため、グループ回転で `rotation` を焼き込むと二重変換で線・ハンドルが崩れていた。`ShapeDefinition.rotate` フック（`move` と対）を追加し、コネクタは端点を回して `rotation` は据え置く（`rotateConnector`）。
  - **回転ハンドルのカーソルを角ごとの回転アイコンにした**。従来は全ての角で `grab` 固定だったが、掴んだ角（ne/se/sw/nw）＋シェイプの現在回転角に合わせた回転カーソル（150°円弧＋接線方向ダブル矢じりの SVG data URI）を表示する。`tool-helpers` に `getRotationCursor(corner, rotationDeg)` を追加し、`findRotationHandleAtScreenPoint` はどの角かも返すようになった。

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 0.6.3

### Patch Changes

- 1a489de: attachable な子 (sticker / kimochi 等) を、貼り付き先が非コンテナでも単独で選択できるようにする。

  `findShapeAtPoint` / marquee は、親を持つ shape のクリック/範囲選択時に「親が container.selectableChildren を宣言していなければ最上位祖先を返す」設計だった。attachable な子は overlap で貼り付くだけで grouping ではないため、非コンテナ (付箋・テキスト等) に貼ると親が選択され、子を掴んで剥がせなかった。attachable な子はヒットした子自身を返すよう修正 (frame/island の selectableChildren や group の祖先解決は不変)。

## 0.6.2

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 0.6.1

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 0.6.0

### Minor Changes

- 759e7be: シェイプの **表示/非表示 (`hidden`) と ロック (`locked`)** をコアのシェイプ・プリミティブとして追加（Figma レイヤーパネル相当の基盤ロジック。パネル UI は含まない）。
  - `ShapeData` に `hidden?` / `locked?` を追加。`hidden` は描画・当たり判定・選択・変形の対象外、`locked` は描画はされるが選択・移動・リサイズ・回転・削除の対象外。いずれも**祖先へカスケード**（グループ/フレームを隠す/ロックすると子孫も実効的にそうなる）。
  - 述語ヘルパー: `isShapeHidden`/`isShapeLocked`（自フラグ, `@edv4h/usketch-shared`）、`isEffectivelyHidden`/`isEffectivelyLocked`（祖先解決, `@edv4h/usketch-store`）。
  - コマンド: `createSetHiddenCommand`/`createSetLockedCommand`（id 指定・undo/Yjs 同期対応。ロック中シェイプは canvas 上で選べないため id で切替）。
  - エンジンが尊重: 描画（全レンダラ経路）で hidden を除外、ヒットテスト・矩形選択・リサイズ/回転ハンドル・全選択・削除で hidden+locked を除外。AI シリアライズにも反映。

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

## 0.5.2

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-store@3.3.1

## 0.5.1

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0

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
