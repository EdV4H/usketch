---
"@edv4h/usketch-plugin-canvas-filter": patch
---

どこからも使われていない `FilterIndicator`（Control HUD のアクションに置き換わった旧フィルタ表示ボタン）と、内部の `applyFilter` を削除した。どちらもパッケージの入口から export されておらず、挙動は変わらない。
