---
"@edv4h/usketch-connector-anchor": minor
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-domain-design": minor
---

新パッケージ `@edv4h/usketch-connector-anchor` を追加。anchor 計算 / endpoint hit-test /
position tracking / cascade delete のロジックを `usketch-plugin-shape-connector` から
抽出し、他の connector plugin が再利用できる純粋ロジック層として独立。

`usketch-plugin-domain-design` は新パッケージを使って独自の `domain-connector`
shape type を実装。BoundedContext / Aggregate / ClassBox 同士を結ぶときに
**anchor 吸着 / shape 移動追従 / endpoint ドラッグ再接続 / cascade delete** が
標準 connector と同等に動作する。relation 種別 (context-map / tactical) と
multiplicity / upstream / label は新規の DDD connector property bar で編集可能。

破壊的変更:

- 旧 `domain-context-map-connector` / `domain-tactical-connector` shape type を廃止
- 既存ボードの旧 connector データは migration なし（クリーンスタート）

`usketch-plugin-shape-connector` の外部 API は変わらない（内部リファクタのみ patch）。
