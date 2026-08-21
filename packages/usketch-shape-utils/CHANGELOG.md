# @edv4h/usketch-shape-utils

## 2.2.8

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0

## 2.2.7

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0

## 2.2.6

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0

## 2.2.5

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0

## 2.2.4

### Patch Changes

- 15f1fe7: editable-text: 再編集時にテキストが空になる不具合を修正し、ダブルクリック判定を 400ms に緩和。
  - contentEditable への既存テキストの流し込みを `data-focused` フラグではなく `document.activeElement === el`（編集中か）でガードするよう変更。blur 以外の経路（Escape / 選択解除 / プログラム的な選択クリア）で編集を抜けたあと、再利用される同一 DOM ノードにフラグが残留し、次回編集時にエディタが空で開いてしまう問題を解消（`deleteWhenEmpty` 系 shape ではその後の入力で破壊的になり得た）。
  - ダブルクリックの同一 shape 判定ウィンドウを 300ms → 400ms に拡大（select tool と一致）。300ms は OS の標準ダブルクリックより短く、やや遅いダブルクリックで編集に入れず 3 クリック目が必要になっていた。

## 2.2.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0

## 2.2.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 2.2.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 2.2.0

### Minor Changes

- 23fcc87: GeoShape（rectangle/rounded-rect/ellipse/triangle/diamond/star）に付箋同様の編集可能ラベルを追加。あわせて text/sticky/geo で重複していたテキスト編集機構を共通化。
  - **shape-utils**: 編集機構を `createEditableTextController`（zag マシン + double-click 検出 + 外側クリック/blur/Esc/選択解除の終了 + undo コミット）と `editableTextProps`（contentEditable の共通ハンドラ）に抽出。text/sticky が各自コピーしていた machine を 3→1 に統一（zag は shape-utils の依存へ移動、react は peer）。`isEditableType` で対象型を、`growHeight` で入力時の高さ追従を切替。
  - **shape-basic (geo)**: 2D 図形に SVG `<text>`/`<foreignObject>` の中央ラベルを追加し、ダブルクリックで編集。`growHeight:false`（図形サイズは維持しテキストは中央で折り返し）。arrow/line は対象外。GPU 描画時はラベル非表示（SVG 描画時のみ）。
  - **shape-text / shape-sticky**: 挙動そのままで共通コントローラへ移行（各自の machine を削除、zag 依存も除去）。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0

## 2.1.2

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0

## 2.1.1

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0

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

## 2.0.3

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0

## 2.0.2

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0

## 2.0.1

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0

## 2.0.0

### Major Changes

- 1265b13: Move `rectGpuPrimitive` / `roundedRectGpuPrimitive` / `ellipseGpuPrimitive` / `lineGpuPrimitive` from `@edv4h/usketch-shape-utils` to `@edv4h/usketch-plugin-shape-basic`.

  These helpers were the only callers of the `cornerRadius` field and were used exclusively by `shape-basic` (no other plugin depended on them). Keeping them in the generic `shape-utils` package leaked plugin-specific knowledge and required an unsafe `(data as { cornerRadius?: number }).cornerRadius` cast inside the otherwise plugin-agnostic utility. Moving them lets `rectGpuPrimitive` accept the typed `RectangleShapeData` directly, eliminating the cast.

  This also aligns the codebase with `shape-freedraw`, which already keeps its own `gpuPrimitive` implementation inside the plugin.

  If you imported these from `@edv4h/usketch-shape-utils`, switch the import path to `@edv4h/usketch-plugin-shape-basic` (the helpers are now re-exported from the plugin's public entry point alongside `RectangleShapeData`).

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

- 07fdeeb: ✨ feat: add `@edv4h/usketch-shape-utils` for third-party shape plugins

  shape プラグイン共通ユーティリティ（`getBounds` / `createResize` / `aabbHitTest` / `ellipseHitTest` / `pointInPolygon` / `lineHitTest` / GPU primitive ヘルパ）を新パッケージ `@edv4h/usketch-shape-utils` として切り出し、サードパーティが `@acme/usketch-plugin-shape-foo` のような独自 shape プラグインを作る際に再利用できるようにした。

  `@edv4h/usketch-plugin-shape-basic` は内部実装を `shape-utils` 依存に切り替え。公開 API / 動作は不変のため破壊的変更なし。

  詳細は `apps/docs` の「Third-Party Plugin Authoring」ガイドを参照。
