---
"@edv4h/usketch-core": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-tool-helpers": patch
"@edv4h/usketch-plugin-ai-actions": patch
"@edv4h/usketch-plugin-croupier": patch
"@edv4h/usketch-plugin-dashboard": patch
"@edv4h/usketch-plugin-debug-hud": patch
"@edv4h/usketch-plugin-domain-design": patch
"@edv4h/usketch-plugin-effect-ripple": patch
"@edv4h/usketch-plugin-elevation": patch
"@edv4h/usketch-plugin-history": patch
"@edv4h/usketch-plugin-laser": patch
"@edv4h/usketch-plugin-markdown-to-shape": patch
"@edv4h/usketch-plugin-pdf-import": patch
"@edv4h/usketch-plugin-portal": patch
"@edv4h/usketch-plugin-presentation": patch
"@edv4h/usketch-plugin-reactions": patch
"@edv4h/usketch-plugin-scatter": patch
"@edv4h/usketch-plugin-shape-basic": patch
"@edv4h/usketch-plugin-shape-card": patch
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-shape-freedraw": patch
"@edv4h/usketch-plugin-shape-group": patch
"@edv4h/usketch-plugin-shape-markdown": patch
"@edv4h/usketch-plugin-shape-sticky": patch
"@edv4h/usketch-plugin-shape-wireframe": patch
"@edv4h/usketch-plugin-spatial-chat": patch
"@edv4h/usketch-plugin-spotlight": patch
"@edv4h/usketch-plugin-start-position": patch
"@edv4h/usketch-plugin-sync-localstorage-yjs": patch
"@edv4h/usketch-plugin-sync-ywebsocket": patch
"@edv4h/usketch-plugin-tabletop": patch
"@edv4h/usketch-plugin-timter": patch
"@edv4h/usketch-plugin-tool-openui": patch
"@edv4h/usketch-plugin-tool-pan": patch
"@edv4h/usketch-plugin-tool-select": patch
"@edv4h/usketch-plugin-voting": patch
---

読み取り専用のページ（見るだけの人）を足した。

- `BoardStore` に `isReadOnly` / `setReadOnly` / `applyExternal`（任意）。読み取り専用のあいだ、閲覧者自身の Shape の追加・変更・削除は止まり、同期で届く他の人の変更と保存したものの読み込みだけが `applyExternal(store, fn)` で通る。読むときは `isReadOnly(store)`。
- `createApp` は `page.edit` が無いと読み取り専用で開き、権限が変わったら追う（`readOnly: true` で権限に関係なく読み取り専用にもできる。そのとき `app.permissions` も `page.edit` を不可と答える）。
- `ToolDefinition.readOnlySafe`: 読み取り専用のページでも使えるツール（select・pan・laser・spotlight・reactions・effect-ripple・spatial-chat）。それ以外のツールには切り替わらず、HUD のツール欄にも出ない（`isToolUsable(store, tool)`）。
- 選択ツールは読み取り専用では選ぶだけ（移動・リサイズ・回転・他のプラグインのハンドルを出さない）。
- 同期（sync-localstorage-yjs / sync-ywebsocket）は doc からストアへ入れるときに `applyExternal` を使う。
- ページを変える HUD の操作に `requires: "page.edit"` を付けた（図形・カード・卓・タイマー・グループ・標高など）。見るだけの人には出ない。
