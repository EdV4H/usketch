# @edv4h/usketch-plugin-shape-sticky

## 3.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0
  - @edv4h/usketch-core@2.0.5

## 3.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-store@3.2.0
  - @edv4h/usketch-core@2.0.4

## 3.0.3

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-core@2.0.3

## 3.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-core@2.0.2
  - @edv4h/usketch-store@3.0.1

## 3.0.1

### Patch Changes

- fa92cf8: **BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

  Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

  Fixes #469.

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0
  - @edv4h/usketch-core@2.0.1

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
  - @edv4h/usketch-core@2.0.0
  - @edv4h/usketch-store@2.0.1

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

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-core@1.1.0
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
  - @edv4h/usketch-core@1.0.0
  - @edv4h/usketch-shared@1.0.0
  - @edv4h/usketch-store@1.0.0
