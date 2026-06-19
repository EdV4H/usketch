# @edv4h/usketch-plugin-shape-card

## 1.2.0

### Minor Changes

- 3e53816: カード / デッキをリサイズ不可（サイズ固定）にできるオプションを追加（#626）。
  - `@edv4h/usketch-plugin-shape-card`:
    - `createCardPlugin({ resizable?: boolean })` — プラグイン全体の既定（既定 `true`）。
    - `CardTypeDefinition.resizable?: boolean` — card-type 単位の指定（プラグイン全体より優先）。「value カードは固定、トランプは可変」のような出し分けが可能。
    - 指定時、`card` / `card-deck` の `ShapeDefinition.resizable` に per-instance で反映される。利用側で `resize` / `applyBounds` を no-op に差し替えるハックが不要になる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.resizable` が `boolean` に加えて述語 `(data) => boolean` を受け付けるようになり、単一 shape type でもインスタンスごとにリサイズ可否を変えられる（後方互換）。判定を一本化する `isShapeResizable(def, shape)` を追加・エクスポート。
  - `@edv4h/usketch-tool-helpers` / `@edv4h/usketch-plugin-tool-select`: リサイズハンドルの当たり判定・カーソル・選択オーバーレイのハンドル表示が `isShapeResizable` 経由で述語形式を尊重するように更新。

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-core@2.0.2
  - @edv4h/usketch-store@3.0.1

## 1.1.0

### Minor Changes

- 2e565d7: 新規プラグイン `@edv4h/usketch-plugin-shape-card` を追加。トランプ・UNO・メディアカード等を表現できる **card-type 拡張ポイント**を持つカードシェイプ。カードは表/裏を持ちダブルクリックで裏返せる（3D フリップ）。配置時アニメーション（カスタマイズ可）とデッキ（山札）機構（ドロー / シャッフル）を備える。リサイズは card-type ごとのアスペクト比固定。データモデルは `ShapeData<TMeta>` の generic（meta）方式。

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0
  - @edv4h/usketch-core@2.0.1
