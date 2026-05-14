---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-plugin-shape-image": minor
"@edv4h/usketch-plugin-ai-image": minor
---

External Content Handler プラグイン API を追加 (#578)。

- `ctx.externalContent.register({ id, kind, match, handle, order })` を新設 (`kind: "file" | "url" | "text"`)。
- 解決ルール: kind フィルタ → match true のうち `order` 最大 1 件のみ実行。同値 last-wins。selection-foreground と同じ意味論。
- canvas-engine が drop / paste の `DataTransfer` / `ClipboardEvent` を `ExternalContent` に正規化。document scope の paste listener を内部で張る (INPUT/TEXTAREA/contentEditable はスキップ)。
- 既存 `canvas:drop` event は後方互換のため残置 (新コードは `ctx.externalContent` を推奨)。
- `usketch-plugin-shape-image` が「画像 file → image shape」の default を `order: 0` で自己登録。
- `usketch-plugin-ai-image` は drop / paste path を撤去。`image:upload` 経由のファイルピッカーは維持。

詳細は `guides/external-content` (en/ja) を参照。
