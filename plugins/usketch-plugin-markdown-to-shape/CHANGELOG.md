# @edv4h/usketch-plugin-markdown-to-shape

## 0.1.0

### Minor Changes

- 1b75eb1: 新規: Markdown → 複数 shape 変換プラグイン `usketch-plugin-markdown-to-shape` + 変換レジストリ。
  - **shared / core**: `PluginContext`（と `AppInstance`）に `markdownConverters` レジストリを追加（`createMarkdownConverterRegistry`）。`MarkdownConverter { nodeTypes/match, order?, convert(node,ctx) → MarkdownShapeSpec[] }` を型で提供。解決は type/match フィルタ → order 最大 → 後勝ち。mdast 非依存の `MarkdownNode` 型で shared を汚さない。
  - **markdown-to-shape プラグイン**: `remark-parse + remark-gfm` で source を mdast にし、top-level ブロックごとに登録 converter（無ければ **`markdown` shape へフォールバック**＝生ソースを slice して保持）で shape 化、縦フローで配置し 1 undo で置換。Control HUD の Action「🧩 Markdown を図形に分解」（markdown 単一選択時のみ）。他の shape プラグインに一切依存しない（IoC：変換先が自分を登録）。
  - **mermaid フローチャート分解**: `mermaid` の `graph`/`flowchart` を **rectangle + text ノード + connector** の編集可能な native 図に分解（`createMermaidFlowchartConverter`）。自前パーサ + `@dagrejs/dagre` レイアウト（同期）で、`ctx.origin` から絶対配置・connector は node id で接続（=移動に追従）。非 flowchart / パース失敗は markdown shape にフォールバック。
  - **MarkdownShapeSpec に `id`/`x`/`y`、MarkdownConverterContext に `origin`** を追加。converter は「単発 spec」も「自前レイアウトのサブグラフ（自 id・絶対座標）」も返せる（orchestrator が枠に積む）。
  - **apps/web**: heading/paragraph/list/blockquote → text、mermaid → 図分解の adapters を `ctx.markdownConverters` に登録（table/code は markdown フォールバック）。プラグインは shape を import せず、app 側 adapter が橋渡し。

  将来 code/table 等の native shape を足す際は converter を登録するだけで良く、プラグイン本体の改変は不要。

- 1653a12: mermaid フローチャートのノード形状を geo shape にマッピング。条件分岐 `{...}` を**菱形（diamond）**に、`((...))` を楕円、`(...)` を角丸に変換する（`[...]` は従来どおり矩形）。ラベルは別の text シェイプではなく geo shape 自身の中央ラベルとして持たせ（先の GeoShape ラベル機能を活用）、矩形ノードのラベルも中央寄せになる。菱形／楕円はラベルが内接矩形に収まるようボックスを拡大。
- c7ff8d9: プラグイン間拡張点を汎用サービススロット化。`PluginContext` から機能専用の `markdownConverters` フィールドを削除し、代わりに汎用の `services`（`ServiceRegistry`: `provide`/`get`/`has`）を追加。Markdown→shape 変換レジストリは core から `usketch-plugin-markdown-to-shape` へ移動し、同プラグインが `ctx.services` に `markdown-converters` キーで provide して own するようになった。カーネル契約（core）が単一機能の関心を持たなくなり、今後の拡張点（export/import 等）も同じスロットに載せられる。

  BREAKING: `ctx.markdownConverters` を使っていたコードは `getMarkdownConverters(ctx)`（`@edv4h/usketch-plugin-markdown-to-shape` からエクスポート）に置き換える。provide 側（プラグイン）は consumer より先に setup される必要がある。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-connector-anchor@0.3.3
