# @edv4h/usketch-plugin-snap

## 2.4.1

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-core@2.4.1

## 2.4.0

### Minor Changes

- fec3b90: snap: 等間隔（distribution）スナップを追加 — ドラッグ中に隣接シェイプとの間隔を等しくする位置へ吸着

  これまでの Snap はエッジ/中心の1次元整列のみで、**等間隔スナップが無かった**。tldraw の
  gap snapping に倣い、2つの挙動を追加:
  - **gap 複製（等間隔配置）**: 既存の隙間 L を、**行内の任意のシェイプの外側**に複製する。例: 2つの
    シェイプが 100px 空いていれば、3つ目をドラッグすると 100px の隙間になる位置へ吸着（3連の等間隔）。
    さらに外側（別のシェイプを越えた先）で等間隔になる位置も対象。既存シェイプに重なる位置は除外。
    同じ長さの隙間は**全部ハイライト**。
  - **gap 中央**: シェイプより広い隙間の中央へ吸着し、左右の間隔を等しくする。

  対象は「同じ行/列」のシェイプ（直交方向の範囲が重なるもの）に限定。整列スナップと軸ごとに競合した
  場合は**より近い方**を採用。ガイドは両端キャップ付きの実線セグメントで、点線の整列線と区別できる。
  リサイズ中は無効。

  あわせて**整列ガイドの不具合も修正**: これまでは吸着値に一致する候補を1つしか反映せず、同じ値に
  複数シェイプが揃っていても線・指標が1シェイプ分しか出なかった。修正後は**同一値の全シェイプを
  1本の連続線＋各シェイプの指標**で反映する（tldraw 同様）。
  - 既定 **ON**。`snap:configure({ distributeSnap: false })` または `createSnapPlugin({ distributeSnap: false })` で無効化可能。
  - 公開型: `SpacingGuide` / `GapSegment` / `SnapResult.gaps` / `SnapSettings.distributeSnap`。
  - 純ロジックは `engine/distribute.ts`（単体テスト付き）。

## 2.3.5

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-core@2.4.0

## 2.3.4

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-core@2.3.2

## 2.3.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-core@2.3.1

## 2.3.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-core@2.3.0

## 2.3.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-core@2.2.0

## 2.3.0

### Minor Changes

- 8c1df08: Debug HUD をプラグイン操作の**汎用コントロール面**に昇格。ホストアプリに専用 UI を足さなくても、プラグイン操作を HUD だけで駆動できる。
  - **Action レジストリ新設**（`@edv4h/usketch-shared` / `@edv4h/usketch-core`）: `PluginContext.actions` / `AppInstance.actions` を追加。プラグインが `ctx.actions.register({ id, label, group?, icon?, params?, run, isActive?, isEnabled? })` で操作を宣言でき、`tools`/`shapes` と同じく `getAll()`/`getOrdered()` で列挙可能・`subscribe` で変更通知。`ActionParam` は `string|number|boolean|color|enum`。
  - **Debug HUD**（`@edv4h/usketch-plugin-debug-hud`）: 新「Controls」パネルを追加。Tool palette（`tools.getOrdered()` → `setActiveToolId`）、Actions（レジストリからボタン/パラメータフォームを自動生成）、任意イベント emit コンソール（未移行操作のフォールバック）、既定スタイル編集 / Clear canvas。DEV 限定を解除し本番でも `` ` `` でトグル可能に。
  - **主要プラグインを Action 登録に移行**: freedraw（ペン種/色/太さ/消しゴム）・snap（On/Off）・bg-grid（背景 grid/dots/none）・card（card-type 選択、選択カードの flip/手札、選択デッキの draw/shuffle）・sticky（色）。挙動は既存イベントを emit するだけで不変。

  残り（wireframe/domain/basic-shape のサブタイプ、connector のプロパティ）は同一パターンで追随予定。既存 Demo UI は撤去せず共存。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [51216e7]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-core@2.1.0

## 2.2.2

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-core@2.0.5

## 2.2.1

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-core@2.0.4

## 2.2.0

### Minor Changes

- 8d341b3: コンテナ機構を type 文字列のハードコードからフラグ駆動に開放し、独自コンテナ型シェイプを可能にした（#647）。
  - `@edv4h/usketch-shared`: `ShapeDefinition.container?: { enabled?, selectableChildren?, autoAttach?, layout? }` を追加（各値は `resizable` 同様の `boolean | ((data) => boolean)` 述語形）。評価ヘルパー `isShapeContainer` / `hasSelectableChildren` / `isContainerAutoAttach` / `getContainerLayout` を追加。
  - `@edv4h/usketch-tool-helpers`: `findShapeAtPoint` / marquee / descendant collection の `frame`/`island`/`group` 型ハードコードを撤廃し、`container` フラグ駆動に。frame/island 相当の子は個別選択、group 相当は親ごと選択。
  - `@edv4h/usketch-store`: 汎用 `createContainmentAttacher`（重なりで parentId 付与/解除、循環ガード、undo 対応）を追加。`createCollisionWatcher` に `isContainer` 述語オプションを追加。
  - `@edv4h/usketch-plugin-snap`: `SnapSettings.excludeTargets`（`snap:configure` 経由）を追加。該当シェイプは吸着先候補からも被スナップからも除外。
  - `@edv4h/usketch-plugin-container`（新規）: `container` 定義を持つシェイプのアタッチ・整列（`container.layout`、`stackLayout`/`gridLayout` 同梱）・スナップ除外を `onMutation`/イベントで駆動。
  - `@edv4h/usketch-plugin-shape-frame`: `container: { selectableChildren: true, autoAttach: true }` を付与し、独自の `autoReparent` を撤去して container プラグインの共有アタッチャに一本化。
  - `@edv4h/usketch-plugin-shape-group` / `@edv4h/usketch-plugin-shape-island`: `container` を付与（後方互換。group は selectableChildren なし＝従来の親ごと選択、island は selectableChildren あり）。

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-core@2.0.3

## 2.1.0

### Minor Changes

- 9db15a1: Alt(Option) キーの挙動を選べる `altBehavior` を追加（#636）。`"invert"` にすると、
  `enabled: false`（スナップ無効）でも Alt 押下中だけ一時的にスナップを効かせられる。
  - `createSnapPlugin({ altBehavior: "invert" })` または `snap:configure({ altBehavior })` で設定。
  - 既定は `"suppress"`（従来どおり Alt 押下中は無条件抑止）で後方互換。
  - `SnapSettings.altBehavior` を追加。

## 2.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-core@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-core@2.0.1

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
  - @edv4h/usketch-core@2.0.0

## 1.0.1

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-core@1.1.0

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
  - @edv4h/usketch-core@1.0.0
  - @edv4h/usketch-shared@1.0.0
