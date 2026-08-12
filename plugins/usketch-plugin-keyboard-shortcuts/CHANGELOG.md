# @edv4h/usketch-plugin-keyboard-shortcuts

## 2.1.9

### Patch Changes

- Updated dependencies [6a1e9b9]
  - @edv4h/usketch-sync@1.2.0

## 2.1.8

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-store@3.5.2

## 2.1.7

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 2.1.6

### Patch Changes

- 6c6702b: ロジック起点のビューポート移動（ズーム変更・特定位置へのジャンプ・zoom-to-fit）をスムーズにアニメーションさせ、デフォルト ON にした。連続的なインタラクション（ホイールズーム・ドラッグパン・ミニマップドラッグ）は従来どおり即時。
  - store: `animateViewportTo(target, opts?)` を追加（rAF による eased 補間、`prefers-reduced-motion`・rAF 不在・無効時は即時フォールバック、割り込みは即時系メソッドが cancel）。`fitToBounds` は既定でアニメ化。`createBoardStore({ viewportAnimation })` と `setViewportAnimation` / `getViewportAnimation` で enabled/duration/easing を調整可能（既定: 有効・350ms・ease-in-out-cubic）。
  - shared: 各プラグインが個別実装していたジャンプ計算を共通 helper `centerOnWorld` / `zoomBy` / `zoomToLevel` / `fitContent` / `screenCenterWorld` / `getScreenSize` に集約（すべて既定でアニメ）。
  - keyboard-shortcuts / tool-vim / whistle / follow-me / debug-hud を共通 helper に移行。follow-me は追従の応答性のため短めのアニメ（180ms）。

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 2.1.5

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 2.1.4

### Patch Changes

- 759e7be: シェイプの **表示/非表示 (`hidden`) と ロック (`locked`)** をコアのシェイプ・プリミティブとして追加（Figma レイヤーパネル相当の基盤ロジック。パネル UI は含まない）。
  - `ShapeData` に `hidden?` / `locked?` を追加。`hidden` は描画・当たり判定・選択・変形の対象外、`locked` は描画はされるが選択・移動・リサイズ・回転・削除の対象外。いずれも**祖先へカスケード**（グループ/フレームを隠す/ロックすると子孫も実効的にそうなる）。
  - 述語ヘルパー: `isShapeHidden`/`isShapeLocked`（自フラグ, `@edv4h/usketch-shared`）、`isEffectivelyHidden`/`isEffectivelyLocked`（祖先解決, `@edv4h/usketch-store`）。
  - コマンド: `createSetHiddenCommand`/`createSetLockedCommand`（id 指定・undo/Yjs 同期対応。ロック中シェイプは canvas 上で選べないため id で切替）。
  - エンジンが尊重: 描画（全レンダラ経路）で hidden を除外、ヒットテスト・矩形選択・リサイズ/回転ハンドル・全選択・削除で hidden+locked を除外。AI シリアライズにも反映。

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

## 2.1.3

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
- Updated dependencies [4148a9c]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-sync@1.1.0
  - @edv4h/usketch-store@3.3.1

## 2.1.2

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0

## 2.1.1

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-store@3.2.0

## 2.1.0

### Minor Changes

- a0c2cf9: 指定位置から「最も近い被らない位置」を求める機能を追加（#581）。
  - `@edv4h/usketch-shape-utils`: 純関数 `findFreePosition`（`ring` / `push` の2戦略）と `overlapsAny` を追加。
  - `@edv4h/usketch-plugin-free-position`（新規）: `free-position:find` イベントで問い合わせ可能。
    ボード上の shape を**回転考慮 AABB**で避けた最近傍の空き位置を返す。
  - `@edv4h/usketch-plugin-keyboard-shortcuts`: paste/duplicate が `free-position:find` を使い、
    複数 shape を相対配置を保ったままグループ単位で被らない位置へ自動配置（free-position 未登録時は
    従来の +20 オフセットにフォールバック）。desired bounds は `ShapeDefinition.getBounds` +
    回転考慮で算出し、平行移動は `ShapeDefinition.move` 経由で行う。
  - `@edv4h/usketch-connector-anchor`: `moveConnector`（`ShapeDefinition.move` 実装）を追加。
    コネクタの `sourcePoint` / `targetPoint` / `controlPoint`（絶対座標）を x/y と同じオフセットで
    平行移動する。
  - `@edv4h/usketch-plugin-shape-connector` / `@edv4h/usketch-plugin-domain-design`: コネクタ shape に
    `move: moveConnector` を登録。paste/duplicate/移動で endpoints が取り残されて形状が崩れるのを防ぐ。

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0

## 2.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-store@3.0.1

## 2.0.1

### Patch Changes

- fa92cf8: **BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

  Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

  Fixes #469.

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0

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

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0
  - @edv4h/usketch-store@2.0.1

## 1.0.1

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-store@2.0.0

## 1.0.0

### Major Changes

- 🎉 Initial stable release — v1.0.0

  uSketch v2 の最初の安定版リリース。MVP 完了基準をすべて満たした状態で公開する。

  ## Highlights
  - **Realtime collaboration** — Cloudflare Durable Objects + Yjs + WebSocket awareness
  - **Offline-first** — y-indexeddb によるローカル永続化、再接続時の自動同期
  - **Pluggable architecture** — 60+ の plugin（shape / tool / sync / AI / presence / export 等）
  - **Presentation mode** — Frame ベースのスライド、edit/present の 2 モード
  - **Export** — PNG / SVG / JSON（Satori + Canvas）
  - **Link sharing & access control** — 公開/限定公開 + role 管理（owner/editor/viewer）
  - **AI-native** — Copilot（ghost shape 提案）/ Chat / Voice / Image 認識

  詳細なリリースノートはルートの `CHANGELOG.md` を参照。

### Patch Changes

- Updated dependencies
  - @edv4h/usketch-shared@1.0.0
  - @edv4h/usketch-store@1.0.0
  - @edv4h/usketch-sync@1.0.0
