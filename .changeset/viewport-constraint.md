---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
---

feat(store): ビューポート制約フック＋汎用スクロール範囲（描画制限）ヘルパー

- 全 viewport 変更が通る単一経路 commitViewport に制約関数を適用する
  `BoardStore.setViewportConstraint((vp)=>vp)` / `getViewportConstraint()` を追加
  （setViewport/panBy/zoomTo/animate すべてコミット時に制約を通るので、保存 viewport が
  制約に反しない＝後追いクランプの競合が無い）。型 ViewportConstraint。
- 汎用の「描画制限」ヘルパーを追加: `clampViewportToBounds(vp, bounds, viewportSize)`（純関数）と
  `boundsConstraint({ getBounds, getViewportSize })`（ViewportConstraint 生成）。任意のプラグイン/
  ホストが `store.setViewportConstraint(boundsConstraint({...}))` でスクロール範囲を設定できる。
