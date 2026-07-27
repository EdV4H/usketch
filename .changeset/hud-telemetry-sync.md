---
"@edv4h/usketch-plugin-debug-hud": patch
"@edv4h/usketch-plugin-sync-localstorage-yjs": patch
"@edv4h/usketch-plugin-sync-ywebsocket": patch
---

HUD テレメトリ移設（第4弾・最終）: Sync/Persistence 状態を app 所有の HUD パネルへ移設し、最後のグローバル `globalThis.__usketchSyncStatus` を完全排除。

- web アプリに `createSyncStatusPanelPlugin`（`ctx.hud.registerPanel`）を追加。`apps/web/src/lib/sync-status-store.ts` にトラッカー swap 対応の `syncStatusStore` を新設（base IDB→cloud divergence の切替を吸収）。app.tsx はグローバル代入を `syncStatusStore.setTracker(...)` に置換。
- Debug/Control HUD から sync 依存を完全撤去: General の Persistence 節、`syncStatus` prop 配線、ShapesPanel の未同期強調（⚠バッジ/フィルタ）、`sync-status-types.ts` を削除。分岐（未同期 shape）は既存の canvas `UnconfirmedOverlay`＋Sync パネルの「⚠ サーバ未同期 N件」で引き続き可視。
- sync プラグイン（localstorage-yjs / ywebsocket）の未読 `__usketchSyncStatus` set/delete（web アプリでは dead code）も削除。

これで `__usketch{SyncStatus,BoardMeta,Presence}` の3グローバルが全廃され、HUD テレメトリ移設シリーズが完了。
