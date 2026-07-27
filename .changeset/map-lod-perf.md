---
"@edv4h/usketch-plugin-map": patch
---

Map タイル LOD の引き（ズームアウト）時のパフォーマンスを大幅改善。

これまでの中間段（mid）はズームアウトしてもセルごとに SVG pattern 塗りを続けており、
画面に大量のセルが入ると pattern 付き `<rect>` が数千〜数万個生成されて激重になっていた。

- LOD を **full / coarse の2段**に整理:
  - **full**（画面上タイル ≥ 24px）: pattern＋外周strip＋揺らぎ。**可視セル範囲のみ**走査（O(可視)、O(全セル)でない）。
  - **coarse**（< 24px＝引き）: **pattern をやめて単色**、かつ**必ずブロック統合**（`ceil` で factor ≥ 2）。
    画面上のブロックサイズを ~24px に保つため、**描画ノード数が地図サイズ・ズームに依存せず頭打ち**に。
- 揺らぎ filter は full のみ。global `renderMode === "lod"` は常に coarse。
