---
"@edv4h/usketch-plugin-debug-hud": patch
---

HUD テレメトリ移設（第3弾）: オンラインメンバー（presence）を app 所有の HUD パネルへ移設し、`globalThis.__usketchPresence` を排除。

- web アプリに `createPresencePanelPlugin`（`ctx.hud.registerPanel`）を追加。`presenceStore` と `readPresenceMembers` を `apps/web/src/lib/presence-store.ts` へ切り出し（グローバル廃止、app が awareness から `set` で供給）。
- Debug/Control HUD から Members パネル（`members-panel.tsx`）・`presence` prop plumbing・`presence-types.ts`・`__usketchPresence` 読み取りを削除。
- メンバー一覧は Controls ドックの Members プラグインセクションに表示（自分のみの時は「（自分のみ）」）。
