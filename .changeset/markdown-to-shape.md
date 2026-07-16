---
"@edv4h/usketch-plugin-markdown-to-shape": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
---

新規: Markdown → 複数 shape 変換プラグイン `usketch-plugin-markdown-to-shape` + 変換レジストリ。

- **shared / core**: `PluginContext`（と `AppInstance`）に `markdownConverters` レジストリを追加（`createMarkdownConverterRegistry`）。`MarkdownConverter { nodeTypes/match, order?, convert(node,ctx) → MarkdownShapeSpec[] }` を型で提供。解決は type/match フィルタ → order 最大 → 後勝ち。mdast 非依存の `MarkdownNode` 型で shared を汚さない。
- **markdown-to-shape プラグイン**: `remark-parse + remark-gfm` で source を mdast にし、top-level ブロックごとに登録 converter（無ければ **`markdown` shape へフォールバック**＝生ソースを slice して保持）で shape 化、縦フローで配置し 1 undo で置換。Control HUD の Action「🧩 Markdown を図形に分解」（markdown 単一選択時のみ）。他の shape プラグインに一切依存しない（IoC：変換先が自分を登録）。
- **mermaid フローチャート分解**: ```mermaid``` の `graph`/`flowchart` を **rectangle + text ノード + connector** の編集可能な native 図に分解（`createMermaidFlowchartConverter`）。自前パーサ + `@dagrejs/dagre` レイアウト（同期）で、`ctx.origin` から絶対配置・connector は node id で接続（=移動に追従）。非 flowchart / パース失敗は markdown shape にフォールバック。
- **MarkdownShapeSpec に `id`/`x`/`y`、MarkdownConverterContext に `origin`** を追加。converter は「単発 spec」も「自前レイアウトのサブグラフ（自 id・絶対座標）」も返せる（orchestrator が枠に積む）。
- **apps/web**: heading/paragraph/list/blockquote → text、mermaid → 図分解の adapters を `ctx.markdownConverters` に登録（table/code は markdown フォールバック）。プラグインは shape を import せず、app 側 adapter が橋渡し。

将来 code/table 等の native shape を足す際は converter を登録するだけで良く、プラグイン本体の改変は不要。
