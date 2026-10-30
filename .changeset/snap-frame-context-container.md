---
"@edv4h/usketch-plugin-snap": patch
---

refactor(snap): 「フレーム内の図形はそのフレーム内だけでスナップする」判定の対象を `type === "frame"` 固定から、ShapeDefinition の `container` 宣言（`hasSelectableChildren`）で判定するようにした。子を個別に選択できるコンテナ（`frame` に加えて音声メモの voice-frame など）が、フレームと同じスナップの範囲分けになる。
