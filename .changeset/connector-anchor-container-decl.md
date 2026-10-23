---
"@edv4h/usketch-connector-anchor": patch
"@edv4h/usketch-shared": patch
"@edv4h/usketch-plugin-shape-connector": patch
---

refactor(connector-anchor): `findShapeAtPoint` のコンテナ判定を `frame` / `group` の型名ハードコードから `ShapeDefinition.container` 宣言（`isShapeContainer`）に置き換え。`container` を宣言する他の図形（例: voice-notes の voice-frame）も、コネクタの接続先判定で中の図形より後回しにされるようになる。`isShapeContainer` は `container` だけを持つ定義も受け取れるよう引数型を `Pick<ShapeDefinition, "container">` に広げた（後方互換）。
