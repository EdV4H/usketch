---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
---

feat(store): ビューポート制約フック `setViewportConstraint` を追加

全 viewport 変更が通る単一のコミット経路（commitViewport）に制約関数を適用する API を
追加。setViewport / panBy / zoomTo / animateViewportTo すべてがコミット時に制約を通るため、
保存される viewport が制約に反することが無い（後追いクランプのような競合が起きない）。
`BoardStore.setViewportConstraint((vp) => vp)` / `getViewportConstraint()`。設定時は現在の
viewport を制約経由で再コミットして即スナップ、null で解除。
