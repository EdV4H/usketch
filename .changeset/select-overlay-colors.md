---
"@edv4h/usketch-plugin-tool-select": minor
---

選択オーバーレイ（選択枠/ハンドル）の色を設定可能に（#637）。固定の青 `#2680eb` から
ホストのテーマ色へ追従できる。

- `createSelectToolPlugin({ overlay: { strokeColor, handleFillColor } })` で初期色を指定。
- 実行時は `select:configure`（snap の `snap:configure` と対）イベントで変更可能。
- 色はインライン `style` で適用するため `var(--colors-primary)` のような CSS 変数も渡せる。
