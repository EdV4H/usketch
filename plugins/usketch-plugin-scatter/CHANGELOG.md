# @edv4h/usketch-plugin-scatter

## 0.2.1

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-shape-utils@2.2.9

## 0.2.0

### Minor Changes

- 3ffac1e: 「新規Shapeを生成してぶちまける」HUD アクションを追加。

  選択した Shape の**コピーを N 個生成して散らす**（関連 Shape が無くても新規生成パスを体験できる）。HUD の「ぶちまけ設定」に **生成数 (`spawnCount`)** を追加し、`scatter:spawn` アクションで実行。種を複製して new-item を組み立てる純関数 `cloneSeedItems(store, seedId, count)` を公開 export に追加。

## 0.1.0

### Minor Changes

- b638b7a: 新プラグイン `@edv4h/usketch-plugin-scatter` — 関連する Shape を「ぶちまける」拡張可能な scatter エンジン。

  選択した 1 つの Shape を起点に、**関連する Shape（および新規生成した Shape）**を外へ散らす。1 つの undoable コマンドで適用し、任意でアニメーション付き。
  - **関連はプラガブル**: 明示 `items`（既存 id ∪ 新規 spec）を渡すか、リゾルバ（組込 `connectors` / `children`、または `registerResolver` で追加）で導出。新規 Shape はその場で生成して散らせる。
  - **レイアウトはパターン選択式**: `radial` / `scatter`（ランダム＋回転・種付き乱数で再現可能）/ `unoverlap`（`findFreePosition` に委譲した非重なり）/ `grid`。`registerPattern` で拡張。
  - **アニメーション可変**: `animate` / `durationMs` / `easing` の飛び散り tween（生書き込み→最終 1 コマンドで冪等コミット）。
  - HUD に「ぶちまけ設定」＋「関連Shapeをぶちまける」アクション（選択 1 個で有効）を登録。ホスト向けに `getScatterApi(services)` を `defineService` で公開。
