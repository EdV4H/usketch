---
"@edv4h/usketch-map-icons": minor
"@edv4h/usketch-plugin-map": minor
---

アイコンセットを別パッケージ `@edv4h/usketch-map-icons` に分離 + territory 描画をヘッドレス化。

**新パッケージ `@edv4h/usketch-map-icons`**: RPG マップのアイコン定義（`ICONS` / `ICONS_BY_KEY` / `IconDef` / `IconCategory` / `ICON_CATEGORIES` / `SvgNode`）をデータのみの依存ゼロパッケージとして切り出し。プラグインからも従来どおり re-export するため既存の `import { ICONS } from "@edv4h/usketch-plugin-map"` は不変。

**territory のヘッドレス化（破壊的変更）**: プラグインは領域(range)・ラベルを自前で描画しなくなり、`territory.region.render` / `territory.label.render` フックにホストの描画を委ねる。`TerritoryStyle` から stock 用パラメータ `fillOpacity` / `border` / `ring` / `label.enabled` を削除（描画は完全にホスト側の render で行う）。既存のデモアプリ（community）は reference 実装 `stockTerritoryStyle` を持ち従来の見た目を維持。render フック未指定だと領域・ラベルは描画されない。
