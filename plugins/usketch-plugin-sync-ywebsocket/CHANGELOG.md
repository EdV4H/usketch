# @edv4h/usketch-plugin-sync-ywebsocket

## 2.0.8

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 2.0.7

### Patch Changes

- 0829b2d: HUD テレメトリ移設（第4弾・最終）: Sync/Persistence 状態を app 所有の HUD パネルへ移設し、最後のグローバル `globalThis.__usketchSyncStatus` を完全排除。
  - web アプリに `createSyncStatusPanelPlugin`（`ctx.hud.registerPanel`）を追加。`apps/web/src/lib/sync-status-store.ts` にトラッカー swap 対応の `syncStatusStore` を新設（base IDB→cloud divergence の切替を吸収）。app.tsx はグローバル代入を `syncStatusStore.setTracker(...)` に置換。
  - Debug/Control HUD から sync 依存を完全撤去: General の Persistence 節、`syncStatus` prop 配線、ShapesPanel の未同期強調（⚠バッジ/フィルタ）、`sync-status-types.ts` を削除。分岐（未同期 shape）は既存の canvas `UnconfirmedOverlay`＋Sync パネルの「⚠ サーバ未同期 N件」で引き続き可視。
  - sync プラグイン（localstorage-yjs / ywebsocket）の未読 `__usketchSyncStatus` set/delete（web アプリでは dead code）も削除。

  これで `__usketch{SyncStatus,BoardMeta,Presence}` の3グローバルが全廃され、HUD テレメトリ移設シリーズが完了。

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 2.0.6

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
- Updated dependencies [4148a9c]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-sync@1.1.0

## 2.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0

## 2.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0

## 2.0.3

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0

## 2.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0

## 2.0.1

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0

## 2.0.0

### Major Changes

- ee6fc3e: **BREAKING**: Plugin lifecycle reworked for React StrictMode safety. Fixes #609.

  `UsketchPlugin.setup(ctx)` now returns the teardown function directly; the `teardown` property on `UsketchPlugin` has been removed. All plugins that previously exported a module-level singleton object (e.g. `selectToolPlugin`, `panToolPlugin`, `gridBgPlugin`) are now factory functions (`createSelectToolPlugin()`, `createPanToolPlugin()`, `createGridBgPlugin()`). Each `createApp` call now owns its own plugin instance and teardown closure, so a second mount cannot overwrite the first's cleanup state.

  `createApp` collects per-instance teardowns and runs them in LIFO order on `destroy()`. `destroy()` is idempotent — repeated calls are no-ops. If a later plugin's `setup` throws, the teardowns collected so far roll back in LIFO order.

  **Migration**:
  1. Replace singleton imports with factory calls at the call site:

     ```diff
     - import { selectToolPlugin, panToolPlugin, gridBgPlugin } from "@edv4h/usketch-plugin-...";
     + import { createSelectToolPlugin, createPanToolPlugin, createGridBgPlugin } from "@edv4h/usketch-plugin-...";

       const app = await createApp({
         store,
     -   plugins: [selectToolPlugin, panToolPlugin, gridBgPlugin],
     +   plugins: [createSelectToolPlugin(), createPanToolPlugin(), createGridBgPlugin()],
       });
     ```

  2. When authoring a custom plugin, return the cleanup from `setup` instead of assigning it to `this.teardown`:
     ```diff
       setup(ctx) {
         const off = ctx.events.on("…", handler);
     -   (this as UsketchPlugin).teardown = () => off();
     +   return () => off();
       },
     - teardown() { … },
     ```
  3. Build plugin arrays inside `useEffect` (or any per-mount scope), not at module level — even with factory functions, sharing a single instance across mounts undoes StrictMode safety.

  Plugins that already shipped as `createXxxPlugin()` (e.g. `createDomRendererPlugin`, `createPresenceCursorPlugin`) keep their factory names; only the `teardown` property has moved to the `setup` return value.

### Minor Changes

- dcbba4d: Add `shouldSync` callback to `YwebsocketSyncOptions`.

  `shouldSync(shape)` is consulted before each local `shape:added` / `shape:updated` is written to the Y.Map: returning `false` keeps the shape in the local store but blocks it from being persisted to or broadcast through the shared document. Local `shape:removed` events are gated on the same Y.Map — removals propagate only for ids actually present in the shared doc (locally-authored or observed from a remote update), so a host bridging in foreign shapes (e.g. tldraw → uSketch migration) doesn't scribble unrelated deletes into the shared doc. If `shouldSync` flips from `true` to `false` for an id this client had previously authored, the stale Y.Map entry is dropped on the next mutation; remote-origin entries are left alone (they belong to whoever wrote them). Defaults to `() => true`, fully backwards compatible.

  Use case: bridging external state (e.g. a tldraw → uSketch migration) into the uSketch store, where some shapes are mirrored read-only and must not be written back to the shared document. Closes #606.

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0

## 1.1.0

### Minor Changes

- 646180a: Add `@edv4h/usketch-plugin-sync-ywebsocket` — bridges uSketch to any y-websocket server. Exposes a `WsProviderHandle`-compatible adapter for drop-in use with `@edv4h/usketch-plugin-presence-cursor`, with hooks for token refresh (`resolveParams`), close-code handling (`onCloseCode`), idle disconnect, and a pre-existing Y.Doc. Closes #574.
- b2570cc: サーバ未同期 Shape を UI で警告できるようにした。

  `SyncStatusTracker` に `unconfirmedShapeIds: readonly string[]` を追加し、
  `provider.on("sync")` 時にサーバが認識している shape ID 集合を確定スナップショット
  として記録。以降、ローカル側のみで `shape:added` された (= サーバから来ていない、
  あるいは IndexedDB に残っていただけの) shape は「未確定」として識別される。

  UI の表示先:
  - ywebsocket plugin が新しい canvas overlay (`unconfirmed-shapes-overlay`,
    layer order 250) を register。未確定 shape の右上に小さな赤い `!` バッジを
    描画 (pointer events 無効、診断のみ)。
  - debug HUD の General パネルに「⚠ サーバ未同期 Shape: N 件」行を追加。
  - debug HUD の Shapes パネルで各行に「⚠ 未同期」バッジを表示。ヘッダの件数
    バッジをクリックすると未同期のみフィルタ。

  ywebsocket plugin が組まれていない (IndexedDB-only) ボードでは何も表示されない。

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
