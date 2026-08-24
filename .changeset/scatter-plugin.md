---
"@edv4h/usketch-plugin-scatter": minor
---

新プラグイン `@edv4h/usketch-plugin-scatter` — 関連する Shape を「ぶちまける」拡張可能な scatter エンジン。

選択した 1 つの Shape を起点に、**関連する Shape（および新規生成した Shape）**を外へ散らす。1 つの undoable コマンドで適用し、任意でアニメーション付き。

- **関連はプラガブル**: 明示 `items`（既存 id ∪ 新規 spec）を渡すか、リゾルバ（組込 `connectors` / `children`、または `registerResolver` で追加）で導出。新規 Shape はその場で生成して散らせる。
- **レイアウトはパターン選択式**: `radial` / `scatter`（ランダム＋回転・種付き乱数で再現可能）/ `unoverlap`（`findFreePosition` に委譲した非重なり）/ `grid`。`registerPattern` で拡張。
- **アニメーション可変**: `animate` / `durationMs` / `easing` の飛び散り tween（生書き込み→最終 1 コマンドで冪等コミット）。
- HUD に「ぶちまけ設定」＋「関連Shapeをぶちまける」アクション（選択 1 個で有効）を登録。ホスト向けに `getScatterApi(services)` を `defineService` で公開。
