---
"@edv4h/usketch-plugin-shape-card": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": patch
"@edv4h/usketch-plugin-tool-select": patch
---

カード / デッキをリサイズ不可（サイズ固定）にできるオプションを追加（#626）。

- `@edv4h/usketch-plugin-shape-card`:
  - `createCardPlugin({ resizable?: boolean })` — プラグイン全体の既定（既定 `true`）。
  - `CardTypeDefinition.resizable?: boolean` — card-type 単位の指定（プラグイン全体より優先）。「value カードは固定、トランプは可変」のような出し分けが可能。
  - 指定時、`card` / `card-deck` の `ShapeDefinition.resizable` に per-instance で反映される。利用側で `resize` / `applyBounds` を no-op に差し替えるハックが不要になる。
- `@edv4h/usketch-shared`: `ShapeDefinition.resizable` が `boolean` に加えて述語 `(data) => boolean` を受け付けるようになり、単一 shape type でもインスタンスごとにリサイズ可否を変えられる（後方互換）。判定を一本化する `isShapeResizable(def, shape)` を追加・エクスポート。
- `@edv4h/usketch-tool-helpers` / `@edv4h/usketch-plugin-tool-select`: リサイズハンドルの当たり判定・カーソル・選択オーバーレイのハンドル表示が `isShapeResizable` 経由で述語形式を尊重するように更新。
