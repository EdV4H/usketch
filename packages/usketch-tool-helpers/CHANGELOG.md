# @edv4h/usketch-tool-helpers

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
