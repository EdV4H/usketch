# @edv4h/usketch-plugin-markdown-to-shape

Markdown を**複数の native shape に分解**する uSketch プラグイン。「どの Markdown 構造をどの shape にするか」は**変換レジストリに登録**する方式（IoC）で、このプラグインは具体的な shape に一切依存しない。

## 仕組み

1. `ctx.markdownConverters`（`@edv4h/usketch-core` が提供、`PluginContext` 経由）に **converter** を登録する:
   ```ts
   ctx.markdownConverters.register({
     id: "app:heading-to-text",
     nodeTypes: ["heading"],        // mdast のノード種別
     order: 0,                       // 高いほど優先、同点は後勝ち
     convert: (node, cctx) => [{ type: "text", text: /* ... */, fontSize: 28 }],
   });
   ```
2. Control HUD の Action **「🧩 Markdown を図形に分解」**（markdown shape を単一選択時のみ有効）を実行すると:
   - `remark-parse + remark-gfm` で source を **mdast** に parse。
   - top-level ブロックごとに登録 converter を解決（`nodeTypes`/`match` → `order` 最大 → 後勝ち）。
   - **未登録のブロックは `markdown` shape にフォールバック**（生ソースを slice して保持するので、表・コード・mermaid もそのまま整形描画される）。
   - 生成 shape を縦フローで配置し、元 markdown shape を置き換える（**1 操作で undo 可能**）。

## 依存の向き（デカップリング）

- このプラグインは `@edv4h/usketch-shared` のみに依存し、**text / table などの shape プラグインを import しない**。
- 変換先は「登録する側」が持つ（例: apps/web の adapter が heading→text を登録）。将来 code/table 等の native shape を足すときも **converter を登録するだけ**で、本体は無改変。
- フォールバックの `markdown` shape は**型文字列だけ**で生成するため、markdown-shape プラグインへのコード依存も無い。

## エクスポート

- `createMarkdownToShapePlugin()` — プラグイン本体。
- `convertMarkdownToShapes(opts)` — source → 配置済み `ShapeData[]`（オーケストレータ）。
- `parseMarkdown` / `topLevelBlocks` / `mdastText` / `nodeSource` — converter 実装用の mdast ヘルパ。

## 非スコープ / 今後

- 高さは v1 では推定（描画前は未確定）。measure ベース精緻化は後段。
- code / table の native shape が無いため当面は markdown フォールバック（設計どおり）。
- 段落内インライン装飾の分解は行わない（段落 = 1 text）。
