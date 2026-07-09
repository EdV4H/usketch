# @edv4h/usketch-plugin-domain-design

## 1.0.3

### Patch Changes

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

- Updated dependencies [8d341b3]
- Updated dependencies [a0c2cf9]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-shape-utils@2.1.0
  - @edv4h/usketch-connector-anchor@0.3.0
  - @edv4h/usketch-canvas-engine@1.1.4
  - @edv4h/usketch-core@2.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-canvas-engine@1.1.3
  - @edv4h/usketch-core@2.0.2
  - @edv4h/usketch-store@3.0.1
  - @edv4h/usketch-connector-anchor@0.2.3
  - @edv4h/usketch-shape-utils@2.0.3

## 1.0.1

### Patch Changes

- fa92cf8: **BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

  Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

  Fixes #469.

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0
  - @edv4h/usketch-canvas-engine@1.1.2
  - @edv4h/usketch-core@2.0.1
  - @edv4h/usketch-connector-anchor@0.2.2
  - @edv4h/usketch-shape-utils@2.0.2

## 1.0.0

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
  - @edv4h/usketch-core@2.0.0
  - @edv4h/usketch-canvas-engine@1.1.1
  - @edv4h/usketch-store@2.0.1
  - @edv4h/usketch-connector-anchor@0.2.1
  - @edv4h/usketch-shape-utils@2.0.1

## 0.2.0

### Minor Changes

- 673ff7a: 新パッケージ `@edv4h/usketch-connector-anchor` を追加。anchor 計算 / endpoint hit-test /
  position tracking / cascade delete のロジックを `usketch-plugin-shape-connector` から
  抽出し、他の connector plugin が再利用できる純粋ロジック層として独立。

  `usketch-plugin-domain-design` は新パッケージを使って独自の `domain-connector`
  shape type を実装。BoundedContext / Aggregate / ClassBox 同士を結ぶときに
  **anchor 吸着 / shape 移動追従 / cascade delete** が標準 connector と同等に
  動作する。relation 種別 (context-map / tactical) と multiplicity / upstream /
  label は新規の DDD connector property bar で編集可能。

  なお endpoint ハンドルでの再接続は本リリースではまだ実装されていない（標準 connector
  の `EndpointOverlay` を `domain-connector` まで広げる作業は follow-up）。endpoint を
  変えたい場合は connector を作り直すか、source/target shape を編集する。

  破壊的変更:
  - 旧 `domain-context-map-connector` / `domain-tactical-connector` shape type を廃止
  - 既存ボードの旧 connector データは migration なし（クリーンスタート）

  `usketch-plugin-shape-connector` の外部 API は変わらない（内部リファクタのみ patch）。

- 0c838a8: Add `@edv4h/usketch-plugin-domain-design` — the official plugin for drawing **DDD** diagrams (both strategic and tactical) on a uSketch board.

  Provides 5 shape types under a single `domain-draw` tool (shortcut `d`):
  - **Strategic**: `domain-bounded-context` (with team / Core/Supporting/Generic classification), `domain-context-map-connector` (Customer/Supplier, Conformist, ACL, Shared Kernel, OHS, Partnership, Published Language, Separate Ways).
  - **Tactical**: `domain-aggregate`, `domain-class-box` (Entity / ValueObject / Service / Repository / DomainEvent / Factory with stereotype dropdown, class name, attributes, methods), `domain-tactical-connector` (inheritance / realization / composition / aggregation / association / dependency).

  Inline editing is supported: double-click a `domain-bounded-context` / `domain-aggregate` / `domain-class-box` to edit its name (plus attributes / methods / stereotype for ClassBox). Edits go through the command system and are undoable.

  This is the **first official plugin to fully use `ShapeData<TMeta>`'s `meta` field** for domain-specific data — the pattern recommended in `shape-system.mdx`. Existing plugins (`connector`, `frame`, `text`, ...) currently put intrinsic fields directly on `ShapeData`; migrating them to `meta` is tracked as a follow-up.

  `apps/web` registers the plugin in its default `basePlugins` array, so it's available out of the box.

### Patch Changes

- Updated dependencies [673ff7a]
- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [1265b13]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-connector-anchor@0.2.0
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-core@1.1.0
  - @edv4h/usketch-canvas-engine@1.1.0
  - @edv4h/usketch-shape-utils@2.0.0
  - @edv4h/usketch-store@2.0.0
