---
"@edv4h/usketch-plugin-map": minor
---

MapLayer（地形タイル）に LOD（Level of Detail）を追加。

画面上のタイルサイズ（`tile × zoom` px）と全体の `renderMode` に応じて段階的に簡略化し、
ズームアウトや大きなマップでの描画コスト（SVG ノード数・pattern/filter）を抑える:

- **full**（14px/tile 以上）: pattern＋オートタイル外周strip＋セル境界＋揺らぎ filter（従来）。
- **mid**（6px 以上）: pattern 塗りのみ（strip/境界/揺らぎなし）。
- **low**（6px 未満）: 単色塗り＋セルを N×N ブロックに**ダウンサンプル（多数決）**して DOM ノードを削減。

グローバル `renderMode === "lod"` のときは最大でも mid に制限。pure ロジック（tier 判定・
ブロック係数・ダウンサンプル）に単体テストを追加。
