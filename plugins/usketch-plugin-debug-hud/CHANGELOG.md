# @edv4h/usketch-plugin-debug-hud

## 3.3.2

### Patch Changes

- 6c6702b: ロジック起点のビューポート移動（ズーム変更・特定位置へのジャンプ・zoom-to-fit）をスムーズにアニメーションさせ、デフォルト ON にした。連続的なインタラクション（ホイールズーム・ドラッグパン・ミニマップドラッグ）は従来どおり即時。
  - store: `animateViewportTo(target, opts?)` を追加（rAF による eased 補間、`prefers-reduced-motion`・rAF 不在・無効時は即時フォールバック、割り込みは即時系メソッドが cancel）。`fitToBounds` は既定でアニメ化。`createBoardStore({ viewportAnimation })` と `setViewportAnimation` / `getViewportAnimation` で enabled/duration/easing を調整可能（既定: 有効・350ms・ease-in-out-cubic）。
  - shared: 各プラグインが個別実装していたジャンプ計算を共通 helper `centerOnWorld` / `zoomBy` / `zoomToLevel` / `fitContent` / `screenCenterWorld` / `getScreenSize` に集約（すべて既定でアニメ）。
  - keyboard-shortcuts / tool-vim / whistle / follow-me / debug-hud を共通 helper に移行。follow-me は追従の応答性のため短めのアニメ（180ms）。

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0

## 3.3.1

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 3.3.0

### Minor Changes

- a2cf227: Debug/Control HUD をプラグイン自動判定＋宣言的コントロール基盤にリファクタ（基盤のみ。GPU/Sync/Members/Board-meta のハードコード除去は後続）。
  - **プラグイン属性付け（自動判定）**: `createApp` が各プラグインに scoped context を渡し、`ctx.actions` / 新設 `ctx.hud` への登録に **所有プラグイン id を透過的に付与**（プラグイン側の変更不要）。`ActionRegistry.getOrdered()` が `pluginId` を返すように拡張。
  - **`ctx.hud`（新設 `HudRegistry`）**: プラグインが宣言的に HUD へ貢献する口。
    - `registerSettings(descriptor)` — **ライブ双方向 settings**（`fields`＋`get/set/subscribe`）。スライダー等が現在値を追従し即反映。
    - `registerPanel(panel)` — 任意 React のカスタムパネル（テレメトリ/独自 UI 用）。
  - **`ctx.plugins`（`PluginInfoRegistry`）**: アクティブなプラグインの `{id,name}` 読み取りビュー。
  - **HUD 描画**: Controls を**プラグインごとのセクション**に再編。各プラグイン配下に settings（ライブ）＋actions＋カスタムパネルを集約し、`action.group` はサブ見出しへ（複数プラグインが同一 group を共有していた重複帰属を解消）。
  - 既存の `ctx.actions.register` は無変更＝全既存プラグイン互換（プラグイン単位で自動整列される）。
  - app の viewport-LOD コントロールを `ctx.hud.registerSettings` へ移行（ライブスライダー化）。

### Patch Changes

- 95bc622: HUD テレメトリ移設（第2弾）: Board メタ（タイトル / Cloud・Local / id）を app 所有の HUD パネルへ移設し、`globalThis.__usketchBoardMeta` を排除。
  - web アプリに `createBoardMetaPanelPlugin`（`ctx.hud.registerPanel`）を追加。`boardMetaStore` を `apps/web/src/lib/board-meta-store.ts` へ切り出し（グローバル廃止、app が `set` で供給）。
  - Debug/Control HUD の General パネルから Board セクション・`boardMeta` prop plumbing・`board-meta-types.ts`・`__usketchBoardMeta` 読み取りを削除。
  - Board 情報は Controls ドックの Board プラグインセクションに表示される。

- 31fc57b: HUD テレメトリ移設（第1弾）: GPU 統計を gpu-renderer 所有の HUD パネルへ移設。
  - gpu-renderer が `ctx.hud.registerPanel` で「GPU」パネル（Active/Inactive＋counts）を登録するようになり、Debug/Control HUD 側の GPU 専用セクション（`"gpu-renderer:stats"` イベントへのハードコード結合）を除去。
  - GPU 統計は Controls ドックの gpu-renderer プラグインセクションに表示される（GeneralPanel からは削除）。GPU 描画ロジックは無変更。

- fc5b102: HUD テレメトリ移設（第3弾）: オンラインメンバー（presence）を app 所有の HUD パネルへ移設し、`globalThis.__usketchPresence` を排除。
  - web アプリに `createPresencePanelPlugin`（`ctx.hud.registerPanel`）を追加。`presenceStore` と `readPresenceMembers` を `apps/web/src/lib/presence-store.ts` へ切り出し（グローバル廃止、app が awareness から `set` で供給）。
  - Debug/Control HUD から Members パネル（`members-panel.tsx`）・`presence` prop plumbing・`presence-types.ts`・`__usketchPresence` 読み取りを削除。
  - メンバー一覧は Controls ドックの Members プラグインセクションに表示（自分のみの時は「（自分のみ）」）。

- 0829b2d: HUD テレメトリ移設（第4弾・最終）: Sync/Persistence 状態を app 所有の HUD パネルへ移設し、最後のグローバル `globalThis.__usketchSyncStatus` を完全排除。
  - web アプリに `createSyncStatusPanelPlugin`（`ctx.hud.registerPanel`）を追加。`apps/web/src/lib/sync-status-store.ts` にトラッカー swap 対応の `syncStatusStore` を新設（base IDB→cloud divergence の切替を吸収）。app.tsx はグローバル代入を `syncStatusStore.setTracker(...)` に置換。
  - Debug/Control HUD から sync 依存を完全撤去: General の Persistence 節、`syncStatus` prop 配線、ShapesPanel の未同期強調（⚠バッジ/フィルタ）、`sync-status-types.ts` を削除。分岐（未同期 shape）は既存の canvas `UnconfirmedOverlay`＋Sync パネルの「⚠ サーバ未同期 N件」で引き続き可視。
  - sync プラグイン（localstorage-yjs / ywebsocket）の未読 `__usketchSyncStatus` set/delete（web アプリでは dead code）も削除。

  これで `__usketch{SyncStatus,BoardMeta,Presence}` の3グローバルが全廃され、HUD テレメトリ移設シリーズが完了。

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 3.2.0

### Minor Changes

- ff86302: Toolbar 操作を Control HUD へ集約する一環で、各プラグインが操作を Control HUD のアクションレジストリ／パネル経由で提供するようになった。
  - **follow-me**: 「Follow」アクショングループを動的登録（オンライン各メンバー＋Unfollow、awareness 変化で再構築）。`f` ショートカットは従来どおり。
  - **presence-cursor**: プレゼンス状態(active/away/busy) を「Presence」アクショングループとして登録（`isActive` で現在値をハイライト、ローカル awareness の `user.status` を更新）。
  - **ai-copilot**: Copilot ON/OFF を「Copilot」トグルアクションとして登録（状態の単一ソースは `copilot:toggle` イベント）。
  - **debug-hud**: オンラインメンバーを表示する Members パネルを追加（`globalThis.__usketchPresence` を購読）、ミニマップにズーム（拡大縮小・現在倍率・リセット）を追加、Controls ドックにアクション検索フィルタを追加。

## 3.1.0

### Minor Changes

- 8c1df08: Debug HUD をプラグイン操作の**汎用コントロール面**に昇格。ホストアプリに専用 UI を足さなくても、プラグイン操作を HUD だけで駆動できる。
  - **Action レジストリ新設**（`@edv4h/usketch-shared` / `@edv4h/usketch-core`）: `PluginContext.actions` / `AppInstance.actions` を追加。プラグインが `ctx.actions.register({ id, label, group?, icon?, params?, run, isActive?, isEnabled? })` で操作を宣言でき、`tools`/`shapes` と同じく `getAll()`/`getOrdered()` で列挙可能・`subscribe` で変更通知。`ActionParam` は `string|number|boolean|color|enum`。
  - **Debug HUD**（`@edv4h/usketch-plugin-debug-hud`）: 新「Controls」パネルを追加。Tool palette（`tools.getOrdered()` → `setActiveToolId`）、Actions（レジストリからボタン/パラメータフォームを自動生成）、任意イベント emit コンソール（未移行操作のフォールバック）、既定スタイル編集 / Clear canvas。DEV 限定を解除し本番でも `` ` `` でトグル可能に。
  - **主要プラグインを Action 登録に移行**: freedraw（ペン種/色/太さ/消しゴム）・snap（On/Off）・bg-grid（背景 grid/dots/none）・card（card-type 選択、選択カードの flip/手札、選択デッキの draw/shuffle）・sticky（色）。挙動は既存イベントを emit するだけで不変。

  残り（wireframe/domain/basic-shape のサブタイプ、connector のプロパティ）は同一パターンで追随予定。既存 Demo UI は撤去せず共存。

### Patch Changes

- 6c661d5: Copilot レビュー指摘の堅牢性修正（#702 マージ後の追随分）:
  - **debug-hud / Control パネル**: Action 実行を `try/catch` + Promise `.catch` で内包し、`finally` で UI 再評価（`isActive`/`isEnabled`）を必ず実行（unhandled rejection 防止・実行後の状態反映を保証）。`Clear canvas` は本番でも HUD が出るため確認ダイアログを追加（0 件は no-op）。
  - **shape-connector**: `setConnectorAnchor` が両端接続時しか動かず、片端未接続の connector で HUD action が silent no-op だった問題を修正（anchor フィールドは常に更新、座標再計算は両端接続時のみ）。

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0

## 3.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0

## 3.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0

## 3.0.3

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0

## 3.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0

## 3.0.1

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0

## 3.0.0

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

## 2.0.0

### Major Changes

- 2f4f755: `ShapeData` contract redesign — layered 3-tier extension model. Closes #575.

  ## Breaking changes

  **1. `ShapeData` is now generic and strictly typed.**

  ```ts
  // Before
  interface ShapeData {
    /* core fields */
    [key: string]: unknown; // any field accepted
  }

  // After
  interface ShapeData<TMeta = Record<string, unknown>> {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style: ShapeStyle;
    rotation?: number;
    zIndex?: string;
    createdAt?: number;
    updatedAt?: number;
    parentId?: string; // NEW — was implicit in plugins
    meta?: TMeta; // NEW — typed domain data
    [key: `x-${string}`]: unknown; // NEW — only `x-*` prefixed keys accepted
  }
  ```

  **2. `_createdAt` / `_updatedAt` renamed** to `createdAt` / `updatedAt` (no leading underscore). The fields are now explicit core fields instead of magic strings stamped by the store.

  **3. `canvas-filter`**: `TimeRangeFilter.field` type is now `"createdAt" | "updatedAt"` (was `"_createdAt" | "_updatedAt"`).

  ## Migration guide

  Shape data can live in three places, in this priority:
  1. **Core fields** — listed explicitly in `ShapeData`. Do not redefine.
  2. **Plugin-intrinsic fields** — declare an extension interface and use it inside your plugin:
     ```ts
     interface TextShapeData extends ShapeData {
       text: string;
       fontSize: number;
     }
     function render(shape: ShapeData) {
       const data = shape as TextShapeData;
       // ...
     }
     ```
  3. **Application/domain data — use `meta` (preferred)**:
     ```ts
     interface WeboardMeta { employeeId?: string }
     const shape: ShapeData<WeboardMeta> = { ..., meta: { employeeId: "emp_1" } };
     ```
  4. **Escape hatch — `x-*` prefix** for top-level fields `meta` cannot cover:
     ```ts
     const shape: ShapeData = { ..., "x-legacyFlag": true };
     ```

  Previously any field name was allowed via `[key: string]: unknown`. That is no longer the case: fields outside the `x-*` namespace must be defined by a plugin extension interface or core.

  If you persisted shapes with top-level domain fields like `{ employeeId: "emp_1" }`, either move them to `meta.employeeId`, or rename to `x-employeeId`. If you stamped shapes with `_createdAt` / `_updatedAt`, rename to `createdAt` / `updatedAt` in stored data.

  See the [shape-system](https://usketch.dev/docs/concepts/shape-system/) and [shape-plugin guide](https://usketch.dev/docs/guides/shape-plugin/) for the full contract.

### Minor Changes

- dcc2c10: ShapeDefinition に shape 自身を AI / 認識 / debug 用に表現する optional な
  拡張ポイント API を追加した。これまで `ai-agent` / `ai-copilot` / `ai-recognize`
  / `debug-hud` が shape 固有フィールド (`text`, `points`, `src`, `cornerRadius`
  等) を読むために使っていた inline cast を、shape プラグイン側の自己宣言に
  置き換える。

  新 API (`packages/shared` の `ShapeDefinition`):
  - `serializeForAi?(shape, ctx?) => Record<string, unknown>` — LLM プロンプト
    埋め込み向けのフラットな表現。慣習として `text: string` は人間可読 label、
    `pointCount: number` は頂点数として cross-shape に解釈される。
  - `serializeForRecognition?(shape, ctx?) => unknown` — 手書き / OCR 認識用
    表現。戻り値は `unknown` で、認識対象外なら `null`。呼び出し側 (ai-recognize)
    が `isRecognitionStroke` / `isRecognitionImage` で形を確認する。これにより
    shape プラグインが ai-recognize ドメイン型を import せずに済む。
  - `debugFields?(shape) => Record<string, unknown>` — debug HUD shapes panel
    用の人間可読フィールドマップ。`serializeForAi` と違い圧縮しない。

  実装した shape プラグインと対応する method:

  | Plugin                    | serializeForAi                                            | serializeForRecognition | debugFields                                     |
  | ------------------------- | --------------------------------------------------------- | ----------------------- | ----------------------------------------------- |
  | `shape-freedraw`          | ✅ pointCount                                             | ✅ stroke               | ✅ pointCount/firstPoint/lastPoint              |
  | `shape-text`              | ✅ text/fontSize                                          | — (null)                | ✅ text/fontSize/fontFamily/isEditing           |
  | `shape-image`             | ✅ srcKind/srcLength/srcOrigin (summary, base64 直送回避) | ✅ image                | ✅ src                                          |
  | `shape-basic` (rectangle) | ✅ cornerRadius                                           | —                       | ✅ cornerRadius                                 |
  | `shape-sticky`            | ✅ text/stickyColor                                       | —                       | ✅ text/fontSize/stickyColor/isEditing          |
  | `shape-connector`         | —                                                         | —                       | ✅ sourceId/targetId/anchors/arrowHead/pathType |

  汎用プラグイン側の切替:
  - `ai-agent/canvas-serializer.ts`: `serializeShape` と `findNearbyLabels` を
    registry 経由 (`registry.get(type).serializeForAi(...)`) に書き換え。
    `(shape as { text? }).text` 等の cast を削除。
  - `ai-copilot/plugin.tsx`: 「直近 10 shape の text を LLM に送る」処理を
    serializeForAi 経由に。書き込み側の cast (suggestion → ShapeData) は
    別軸の課題として OOS で残置。
  - `ai-recognize`: 新規 `contract.ts` に `RecognitionStroke` / `RecognitionImage`
    型と type guard を追加。シリアライザは `stroke-serializer.ts` に改名
    (関数 `serializeStrokesForRecognition`) して registry + type guard 経由に
    切替。
  - `debug-hud/panels/shapes-panel.tsx`: `debugFields` 実装 shape はそれを使い、
    未実装 shape は `KNOWN_KEYS` 補集合で fallback。`KNOWN_KEYS` は常時表示用の
    8 キー (id / type / x / y / width / height / style / rotation) のままで、
    `meta` / `parentId` / `zIndex` / `createdAt` / `updatedAt` は fallback の
    custom セクションに表示される。`x-*` 拡張は startsWith で補集合から除外。

  排除した cast: 9 箇所 (5 ファイル)。書き込み側の `ai-copilot:67,70` は
  `applySuggestion?(partial) => Partial<ShapeData>` のような対称 API として
  別 issue で扱う予定。

  Closes #584.

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

- 5766fa8: Fix severe FPS drop while dragging shapes when `debug-hud` is enabled.
  - `@edv4h/usketch-plugin-debug-hud` now coalesces event-log notifications via `requestAnimationFrame`, so a burst of `shape:updated` events during a drag triggers at most one HUD re-render per frame. The capture path is also gated on HUD visibility: while the HUD is hidden, the monkey-patched `emit` short-circuits to a single boolean read and pushes nothing into the logger.
  - `@edv4h/usketch-core` / `@edv4h/usketch-shared`: `EventBus` gains `pause()`, `resume()`, and `isPaused()`. `emit()` becomes a no-op while paused; `on()`/`off()` keep working so subscribers registered during a paused window receive events after resume. Provided as a general-purpose hook for callers that need to suspend delivery during hot paths.

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0

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
