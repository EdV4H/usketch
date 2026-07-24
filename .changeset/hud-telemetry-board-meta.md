---
"@edv4h/usketch-plugin-debug-hud": patch
---

HUD テレメトリ移設（第2弾）: Board メタ（タイトル / Cloud・Local / id）を app 所有の HUD パネルへ移設し、`globalThis.__usketchBoardMeta` を排除。

- web アプリに `createBoardMetaPanelPlugin`（`ctx.hud.registerPanel`）を追加。`boardMetaStore` を `apps/web/src/lib/board-meta-store.ts` へ切り出し（グローバル廃止、app が `set` で供給）。
- Debug/Control HUD の General パネルから Board セクション・`boardMeta` prop plumbing・`board-meta-types.ts`・`__usketchBoardMeta` 読み取りを削除。
- Board 情報は Controls ドックの Board プラグインセクションに表示される。
