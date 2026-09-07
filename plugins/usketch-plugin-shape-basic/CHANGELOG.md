# @edv4h/usketch-plugin-shape-basic

## 2.1.9

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0
  - @edv4h/usketch-core@2.4.3
  - @edv4h/usketch-shape-utils@2.2.9

## 2.1.8

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-core@2.4.2
  - @edv4h/usketch-store@3.5.4
  - @edv4h/usketch-shape-utils@2.2.8

## 2.1.7

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-core@2.4.1
  - @edv4h/usketch-store@3.5.3
  - @edv4h/usketch-shape-utils@2.2.7

## 2.1.6

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-core@2.4.0
  - @edv4h/usketch-store@3.5.2
  - @edv4h/usketch-shape-utils@2.2.6

## 2.1.5

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-core@2.3.2
  - @edv4h/usketch-store@3.5.1
  - @edv4h/usketch-shape-utils@2.2.5

## 2.1.4

### Patch Changes

- Updated dependencies [15f1fe7]
  - @edv4h/usketch-shape-utils@2.2.4

## 2.1.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0
  - @edv4h/usketch-core@2.3.1
  - @edv4h/usketch-shape-utils@2.2.3

## 2.1.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-core@2.3.0
  - @edv4h/usketch-store@3.4.1
  - @edv4h/usketch-shape-utils@2.2.2

## 2.1.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-core@2.2.0
  - @edv4h/usketch-store@3.4.0
  - @edv4h/usketch-shape-utils@2.2.1

## 2.1.0

### Minor Changes

- 23fcc87: GeoShape（rectangle/rounded-rect/ellipse/triangle/diamond/star）に付箋同様の編集可能ラベルを追加。あわせて text/sticky/geo で重複していたテキスト編集機構を共通化。
  - **shape-utils**: 編集機構を `createEditableTextController`（zag マシン + double-click 検出 + 外側クリック/blur/Esc/選択解除の終了 + undo コミット）と `editableTextProps`（contentEditable の共通ハンドラ）に抽出。text/sticky が各自コピーしていた machine を 3→1 に統一（zag は shape-utils の依存へ移動、react は peer）。`isEditableType` で対象型を、`growHeight` で入力時の高さ追従を切替。
  - **shape-basic (geo)**: 2D 図形に SVG `<text>`/`<foreignObject>` の中央ラベルを追加し、ダブルクリックで編集。`growHeight:false`（図形サイズは維持しテキストは中央で折り返し）。arrow/line は対象外。GPU 描画時はラベル非表示（SVG 描画時のみ）。
  - **shape-text / shape-sticky**: 挙動そのままで共通コントローラへ移行（各自の machine を削除、zag 依存も除去）。

- a65da25: shape/tool 系の操作を Action レジストリに完全移行し、追従設定 UI を撤去（Control HUD に一本化）。ホストアプリに専用 UI を足さなくても操作できる。
  - **新規 Action**（`ctx.actions.register`、Control HUD が自動 UI 化）:
    - tool-select: 選択オブジェクトの `fill`/`stroke`/`strokeWidth`/`opacity`、`Bring to front`/`Send to back`/`Delete`（group "Selection"）。→ 追従 StylePanel を置換。
    - connector: 選択コネクタの `arrowHead`/`pathType`/`sourceAnchor`/`targetAnchor`（端点再計算込み）。→ 追従 ConnectorPropertyBar を置換。
    - wireframe / domain-design / basic-shape: サブタイプ選択。
    - export: PNG / SVG / JSON。
  - **撤去した追従設定 UI**（機能は Action として存続）:
    - freedraw の設定 palette レイヤー（`freedraw-cursor` は維持）。
    - card の操作メニュー（`card-menu` レイヤー / CardActionMenu）。手札トレイは維持。
  - 直接操作ハンドル（resize/rotate・connector 端点/アンカー/ラベル編集）は対象外で維持。

  apps/web 側では Toolbar のツール列/undo-redo/背景/StylePanel と ConnectorPropertyBar プラグインを撤去（Cloud/AI・theme・command palette・zoom は据え置き）。

### Patch Changes

- Updated dependencies [23fcc87]
- Updated dependencies [8c1df08]
- Updated dependencies [51216e7]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shape-utils@2.2.0
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-core@2.1.0
  - @edv4h/usketch-store@3.3.1

## 2.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0
  - @edv4h/usketch-core@2.0.5
  - @edv4h/usketch-shape-utils@2.1.2

## 2.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-store@3.2.0
  - @edv4h/usketch-core@2.0.4
  - @edv4h/usketch-shape-utils@2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies [8d341b3]
- Updated dependencies [a0c2cf9]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-shape-utils@2.1.0
  - @edv4h/usketch-core@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-core@2.0.2
  - @edv4h/usketch-store@3.0.1
  - @edv4h/usketch-shape-utils@2.0.3

## 2.0.1

### Patch Changes

- fa92cf8: **BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

  Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

  Fixes #469.

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0
  - @edv4h/usketch-core@2.0.1
  - @edv4h/usketch-shape-utils@2.0.2

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
  - @edv4h/usketch-store@2.0.1
  - @edv4h/usketch-shape-utils@2.0.1

## 1.2.0

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

- 1265b13: Move `rectGpuPrimitive` / `roundedRectGpuPrimitive` / `ellipseGpuPrimitive` / `lineGpuPrimitive` from `@edv4h/usketch-shape-utils` to `@edv4h/usketch-plugin-shape-basic`.

  These helpers were the only callers of the `cornerRadius` field and were used exclusively by `shape-basic` (no other plugin depended on them). Keeping them in the generic `shape-utils` package leaked plugin-specific knowledge and required an unsafe `(data as { cornerRadius?: number }).cornerRadius` cast inside the otherwise plugin-agnostic utility. Moving them lets `rectGpuPrimitive` accept the typed `RectangleShapeData` directly, eliminating the cast.

  This also aligns the codebase with `shape-freedraw`, which already keeps its own `gpuPrimitive` implementation inside the plugin.

  If you imported these from `@edv4h/usketch-shape-utils`, switch the import path to `@edv4h/usketch-plugin-shape-basic` (the helpers are now re-exported from the plugin's public entry point alongside `RectangleShapeData`).

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [1265b13]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-core@1.1.0
  - @edv4h/usketch-shape-utils@2.0.0
  - @edv4h/usketch-store@2.0.0

## 1.1.0

### Minor Changes

- 07fdeeb: ✨ feat: add `@edv4h/usketch-shape-utils` for third-party shape plugins

  shape プラグイン共通ユーティリティ（`getBounds` / `createResize` / `aabbHitTest` / `ellipseHitTest` / `pointInPolygon` / `lineHitTest` / GPU primitive ヘルパ）を新パッケージ `@edv4h/usketch-shape-utils` として切り出し、サードパーティが `@acme/usketch-plugin-shape-foo` のような独自 shape プラグインを作る際に再利用できるようにした。

  `@edv4h/usketch-plugin-shape-basic` は内部実装を `shape-utils` 依存に切り替え。公開 API / 動作は不変のため破壊的変更なし。

  詳細は `apps/docs` の「Third-Party Plugin Authoring」ガイドを参照。

### Patch Changes

- Updated dependencies [07fdeeb]
  - @edv4h/usketch-shape-utils@1.0.0

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
