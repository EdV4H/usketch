# @edv4h/usketch-plugin-shape-image

## 3.2.6

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-plugin-asset-store@0.1.7

## 3.2.5

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-plugin-asset-store@0.1.6

## 3.2.4

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-plugin-asset-store@0.1.5

## 3.2.3

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-plugin-asset-store@0.1.4

## 3.2.2

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-plugin-asset-store@0.1.3

## 3.2.1

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-plugin-asset-store@0.1.2

## 3.2.0

### Minor Changes

- 291a5ab: SVG をベクターのまま画像 shape として表示できるように（#791）。
  - **ファイル D&D（ベクター維持）**: `.svg` / `image/svg+xml` のドロップは JPEG へラスタライズせず、サニタイズ済みマークアップを `data:image/svg+xml,…` として `<img src>` に埋め込む。サイズは `width`/`height`、無ければ `viewBox` から算出（従来の `naturalWidth === 0` 問題を回避）。
  - **`.svg` URL のドロップ／ペースト対応**: 新規 `createImageUrlHandler`（`order: 5`）が `.svg` URL を画像 shape 化。embed の汎用 URL ハンドラ（`order: 0`）より優先されるため、SVG リンクは iframe でなく画像として配置される。それ以外の URL は従来どおり embed にフォールスルー。
  - **サニタイズ徹底**: 取り込み時に `<script>` / `<foreignObject>`・`on*` イベントハンドラ属性・`javascript:` な (x)href/src を除去（`sanitizeSvg`）。`<img>` の非スクリプト実行コンテキストによるブラウザ保証に加えた多層防御。パース不能・非 SVG は取り込み拒否。リモート `.svg` URL は取得しないためサニタイズ不可だが、同じ `<img>` 非スクリプト保証に依拠。

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-plugin-asset-store@0.1.1

## 3.1.0

### Minor Changes

- fa98ca4: アセットストアを追加（issue #738、tldraw `TLAssetStore` 相当）。画像などの重い blob を **content-addressed な asset レコード**として共有 `Y.Doc` の `assets` マップに一度だけ保持し、shape は `assetId` 参照のみを持つ。既存 Durable Object が任意 Y.Map を汎用リレー＆永続するため**サーバ改修なし**で全クライアント同期・遅参加/再接続でも再利用できる。
  - 新規 `usketch-plugin-asset-store`: `createAssetStore(doc)`（既定 upload は `asset:<hash>` の content-hash dedup、`resolve`、`setUploader`/`setResolver` で外部アップロード/署名URLに差し替え可能）、`ctx.services` 経由で提供（`getAssetStore(ctx)`）。プラグインが自由に put/resolve できる汎用機構。
  - `usketch-plugin-shape-image`: 取り込んだ画像を asset ストアへ upload し shape は `assetId` 参照に。**複製・同一画像の再取り込みで base64 が重複せず同期も1回**。描画は asset マップを購読して remote 到着時に再描画、AI/認識シリアライズは assetId を解決。既存の inline `src`（data:/URL）は後方互換で従来どおり。

### Patch Changes

- Updated dependencies [fa98ca4]
  - @edv4h/usketch-plugin-asset-store@0.1.0

## 3.0.6

### Patch Changes

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

- 899b4b2: External Content Handler プラグイン API を追加 (#578)。
  - `ctx.externalContent.register({ id, kind, match, handle, order })` を新設 (`kind: "file" | "url" | "text"`)。
  - 解決ルール: kind フィルタ → match true のうち `order` 最大 1 件のみ実行。同値 last-wins。selection-foreground と同じ意味論。
  - canvas-engine が drop / paste の `DataTransfer` / `ClipboardEvent` を `ExternalContent` に正規化。document scope の paste listener を内部で張る (INPUT/TEXTAREA/contentEditable はスキップ)。
  - 既存 `canvas:drop` event は後方互換のため残置 (新コードは `ctx.externalContent` を推奨)。
  - `usketch-plugin-shape-image` が「画像 file → image shape」の default を `order: 0` で自己登録。
  - `usketch-plugin-ai-image` は drop / paste path を撤去。`image:upload` 経由のファイルピッカーは維持。

  詳細は `guides/external-content` (en/ja) を参照。

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
