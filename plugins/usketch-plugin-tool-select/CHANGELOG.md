# @edv4h/usketch-plugin-tool-select

## 3.4.0

### Minor Changes

- 33a4ef2: feat: フレーム（など子を持つ図形）を削除するとき、中身ごと削除するか、フレームだけ削除して中身を残すかを選べるようにした。ロックの「中身ごとロック / フレームだけロック」（`lockScope: "self"`）と同じ設計。削除・ロックのキー割り当てはホストから変更できる。
  
  - store: `createDeleteShapesCommand(store, shapeIds, scope?)` を追加。`createSetLockedCommand` と同じく `scope: "self"` で自分だけに効く（子は削除した図形の親に付け替わり、位置はそのまま）。複数図形の削除が 1 回の Undo で戻るようにもなった。
  - tool-select: 既定のキーは Delete / Backspace = 中身ごと削除、Shift+Delete / Shift+Backspace = フレームだけ削除、Mod+Shift+L = ロック切替（中身ごと）。フレームだけロックは既定では割り当てなし。
  - tool-select: `createSelectToolPlugin({ keybindings })` で `delete` / `deleteSelf` / `toggleLock` / `toggleLockSelf` のキーを差し替え・無効化できる（既定値は `DEFAULT_SELECT_TOOL_KEYBINDINGS`）。
  - tool-select: ホストのツールバー向けに純関数 `createDeleteSelectionCommand(store, scope?)`（ロック・非表示の図形は除外）と `createToggleLockSelectionCommand(store, scope?)`（全部同じ scope でロック済みなら解除、それ以外はロック）を公開。
  - tool-select: プラグイン破棄時に削除キーの登録を解除するようにした。

### Patch Changes

- Updated dependencies [33a4ef2]
- Updated dependencies [157cce0]
- Updated dependencies [e51e673]
  - @edv4h/usketch-store@3.11.0
  - @edv4h/usketch-tool-helpers@0.8.1

## 3.3.0

### Minor Changes

- 2fe644e: テキストに Figma 風の自動幅を追加。新規テキストは入力に合わせて横に広がり（折り返しなし）、左右・四隅のハンドルで幅を変えると固定幅（折り返し）に切り替わる。左右ハンドルのダブルクリックで自動幅に戻り内容にフィットする。`ShapeDefinition.onHandleDoubleClick`、編集コントローラの `fitOnInput` / `cancelPendingClick` を追加。 IME 変換中も未確定文字に合わせて幅を広げる（`TEXT_PREVIEW_EVENT`）。
  
  - 複数選択のリサイズでも幅が変われば固定幅に切り替える（text に `applyBounds` を追加）
  - 子をレイアウトするコンテナ（グリッド等）の中では、入力時に幅を争わず固定幅に切り替える
  - 2px 未満の横ハンドル操作（ダブルクリック時の手ぶれ等）では幅も自動幅も変えない
  - 回転したテキストは入力で大きさが変わっても左上の角を保つ
  - `fitOnInput` に適用予定の高さ（`next.height`）を渡し、`fitOnInput` が変えたフィールドはすべて編集の Undo 1 手に含める
  
  AI / MCP 経由で作るテキストは固定幅のまま（#1210）。
- 9b3a0a1: feat(tool-select): Option(Alt)+ドラッグで選択図形を複製（Figma と同じく元はその場に残り、複製が動く）。ドラッグ中に Option を押す/離すで複製⇔移動を即切替。ドラッグ中の複製は履歴なしで store に入れて動かすので、共同編集の相手にも複製が動いて見える。ドロップで 1 つの追加コマンドに置き換え、Undo / Redo とも 1 手。動かさずに離したら複製しない。
  
  - **snap（挙動の変更）**: スナップを一時的に切り替えるキーを Alt(Option) から **Ctrl / Cmd** に変更（Alt は複製に使うため）。`altBehavior` オプションは名前を変えずに Ctrl / Cmd の挙動を指定する。
  - tool-select: 複製の純関数 `addDragCopies` / `commitDragCopies` / `removeDragCopies` / `resolveCopyParents` / `duplicateTargetIds` を export。複製の親（フレームへの出し入れ）は containment-attacher と同じ規則で先に決め、追加時に別の reparent が履歴に積まれないようにした。ドラッグ中の Alt キーは preventDefault する（Windows でメニューバーにフォーカスが移らないように）。
  - store: 複製の純関数 `collectWithDescendants` / `connectorsBetween` / `cloneShapes` / `rootShapeIds` / `translateShape`、複数追加を 1 手にする `createAddShapesCommand`、attacher と同じ親の決め方 `findAttachParent` を追加。
  - store: `createContainmentAttacher` は、`parentId` 付きで追加された shape の親を保つ（フレームはまだその shape を含んでいれば、グループは常に）。Cmd+D / ペーストで複製を元フレームに重ねて置いたときに元フレームへ誤って付け替わる問題と、グループの複製で子がグループから外れる問題の修正。
  - store: `cloneShapes` は `isEditing` を引き継がない（複製がテキスト編集モードで始まりフォーカスを奪わない）。
  - keyboard-shortcuts: Cmd+D / ペーストが frame・group の子孫と、それらを結ぶコネクタも複製し、両端とも複製されたコネクタの `sourceId` / `targetId` を複製先へ張り替えるよう修正。Undo 1 回で全体が戻る。確定後は複製元で選択していた図形の複製だけを選択する（間のコネクタは選択しない）。

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
- Updated dependencies [6f3ef3b]
- Updated dependencies [9b3a0a1]
  - @edv4h/usketch-shared@4.19.0
  - @edv4h/usketch-tool-helpers@0.8.0
  - @edv4h/usketch-store@3.10.0
  - @edv4h/usketch-core@2.4.9

## 3.2.16

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0
  - @edv4h/usketch-core@2.4.8
  - @edv4h/usketch-store@3.9.2
  - @edv4h/usketch-tool-helpers@0.7.10

## 3.2.15

### Patch Changes

- 16c8b8b: 図形をドラッグ中のドロップ先ハイライトを、固定の type（`frame` / `group`）ではなく shape 定義の `container.autoAttach`（`isContainerAutoAttach`）で判定する。実際に子として取り込むコンテナ（containment attacher と同じ条件）だけがハイライトされるようになり、ドロップしても取り込まれない `group` はハイライトされなくなる。

## 3.2.14

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0
  - @edv4h/usketch-core@2.4.7
  - @edv4h/usketch-store@3.9.1
  - @edv4h/usketch-tool-helpers@0.7.9

## 3.2.13

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0
  - @edv4h/usketch-store@3.9.0
  - @edv4h/usketch-core@2.4.6
  - @edv4h/usketch-tool-helpers@0.7.8

## 3.2.12

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0
  - @edv4h/usketch-core@2.4.5
  - @edv4h/usketch-store@3.8.1
  - @edv4h/usketch-tool-helpers@0.7.7

## 3.2.11

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0
  - @edv4h/usketch-store@3.8.0
  - @edv4h/usketch-tool-helpers@0.7.6
  - @edv4h/usketch-core@2.4.4

## 3.2.10

### Patch Changes

- Updated dependencies [1854e30]
  - @edv4h/usketch-store@3.7.0
  - @edv4h/usketch-tool-helpers@0.7.5

## 3.2.9

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0
  - @edv4h/usketch-core@2.4.3
  - @edv4h/usketch-tool-helpers@0.7.4

## 3.2.8

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-core@2.4.2
  - @edv4h/usketch-store@3.5.4
  - @edv4h/usketch-tool-helpers@0.7.3

## 3.2.7

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-core@2.4.1
  - @edv4h/usketch-store@3.5.3
  - @edv4h/usketch-tool-helpers@0.7.2

## 3.2.6

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-core@2.4.0
  - @edv4h/usketch-store@3.5.2
  - @edv4h/usketch-tool-helpers@0.7.1

## 3.2.5

### Patch Changes

- bba174a: 回転まわりの選択 UI を修正。
  - **複数選択したシェイプを回転できるようにした**。従来は回転ハンドルの検出が単一選択限定で、複数選択（グループ化していない選択）は回転できなかった。複数選択のバウンディングボックスの角外側に回転ゾーンを追加し、選択中の全シェイプを共通中心まわりに剛体回転する `startMultiRotateSession` を追加（コネクタは端点回転、undo/redo 対応）。ホバー時は回転カーソルも出る。
  - **図形のコネクタ・アンカーハンドル（上下左右）が図形の回転に追従するようにした**。従来は回転した図形でもアンカー（コネクタの始点/接続点）が軸平行の辺の中点に出ていて、辺から外れていた。`getAnchorPoint` / `clampToShapeEdge` を回転対応にし（ローカル座標で計算 → 中心まわりに回転して world 座標へ）、選択時の外側オフセットも辺の法線方向へ回すようにした。これで回転済み図形からも正しい辺の位置でコネクタを繋げられる。
  - **グループ回転でコネクタが崩れる不具合を修正**。コネクタは形状を端点（絶対座標）で定義するため、グループ回転で `rotation` を焼き込むと二重変換で線・ハンドルが崩れていた。`ShapeDefinition.rotate` フック（`move` と対）を追加し、コネクタは端点を回して `rotation` は据え置く（`rotateConnector`）。
  - **回転ハンドルのカーソルを角ごとの回転アイコンにした**。従来は全ての角で `grab` 固定だったが、掴んだ角（ne/se/sw/nw）＋シェイプの現在回転角に合わせた回転カーソル（150°円弧＋接線方向ダブル矢じりの SVG data URI）を表示する。`tool-helpers` に `getRotationCursor(corner, rotationDeg)` を追加し、`findRotationHandleAtScreenPoint` はどの角かも返すようになった。

- Updated dependencies [bba174a]
  - @edv4h/usketch-tool-helpers@0.7.0
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-core@2.3.2
  - @edv4h/usketch-store@3.5.1

## 3.2.4

### Patch Changes

- Updated dependencies [1a489de]
  - @edv4h/usketch-tool-helpers@0.6.3

## 3.2.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0
  - @edv4h/usketch-core@2.3.1
  - @edv4h/usketch-tool-helpers@0.6.2

## 3.2.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-core@2.3.0
  - @edv4h/usketch-store@3.4.1
  - @edv4h/usketch-tool-helpers@0.6.1

## 3.2.1

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
  - @edv4h/usketch-core@2.2.0
  - @edv4h/usketch-store@3.4.0
  - @edv4h/usketch-tool-helpers@0.6.0

## 3.2.0

### Minor Changes

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

- Updated dependencies [8c1df08]
- Updated dependencies [51216e7]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-core@2.1.0
  - @edv4h/usketch-store@3.3.1
  - @edv4h/usketch-tool-helpers@0.5.2

## 3.1.4

### Patch Changes

- a7b3e78: hover 中の shape を選択インジケータ層から参照できるようにした（#664）。selection と同じ仕組みで、カスタム `SelectionForeground` が shape 種別ごとに hover インジケータを差し替えられる。
  - `LayerRenderContext.hoveredShapeId: string | null` を追加（`selection` の hover 版）。
  - `BoardStore` に `getHoveredShapeId()` / `setHoveredShapeId()` を追加（UI シグナルとして store が単一の真実源で保持。`subscribe` で購読可能）。
  - `usketch-plugin-tool-select` は hover をプラグイン内部の module state ではなく store に書き込むようにし（`hover-state.ts` を撤去）、canvas-engine が `LayerRenderContext` に載せる。hover を追跡しないツールでは `null`。
  - hover 変更は主 subscribe チャネルに載るが、`useSyncExternalStore` のセレクタ等価判定により selection/shapes の購読者は再描画されない。

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0
  - @edv4h/usketch-core@2.0.5
  - @edv4h/usketch-tool-helpers@0.5.1

## 3.1.3

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-tool-helpers@0.5.0
  - @edv4h/usketch-store@3.2.0
  - @edv4h/usketch-core@2.0.4

## 3.1.2

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-tool-helpers@0.4.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-core@2.0.3

## 3.1.1

### Patch Changes

- f1caa1b: 選択オーバーレイ色をモジュール共有シングルトンから setup(インスタンス)スコープへ変更（#640）。
  複数 App 同時生成（React StrictMode / 非同期 createApp の二重マウント）で、破棄された
  インスタンスの teardown が生存インスタンスの色を既定へ戻す不具合を修正。`createOverlayColorStore`
  を setup 内で生成し overlay に props で渡す（teardown reset は撤去）。`createSelectToolPlugin`
  / `select:configure` の API は不変。

## 3.1.0

### Minor Changes

- 9db15a1: 選択オーバーレイ（選択枠/ハンドル）の色を設定可能に（#637）。固定の青 `#2680eb` から
  ホストのテーマ色へ追従できる。
  - `createSelectToolPlugin({ overlay: { strokeColor, handleFillColor } })` で初期色を指定。
  - 実行時は `select:configure`（snap の `snap:configure` と対）イベントで変更可能。
  - 色はインライン `style` で適用するため `var(--colors-primary)` のような CSS 変数も渡せる。

## 3.0.2

### Patch Changes

- 3e53816: カード / デッキをリサイズ不可（サイズ固定）にできるオプションを追加（#626）。
  - `@edv4h/usketch-plugin-shape-card`:
    - `createCardPlugin({ resizable?: boolean })` — プラグイン全体の既定（既定 `true`）。
    - `CardTypeDefinition.resizable?: boolean` — card-type 単位の指定（プラグイン全体より優先）。「value カードは固定、トランプは可変」のような出し分けが可能。
    - 指定時、`card` / `card-deck` の `ShapeDefinition.resizable` に per-instance で反映される。利用側で `resize` / `applyBounds` を no-op に差し替えるハックが不要になる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.resizable` が `boolean` に加えて述語 `(data) => boolean` を受け付けるようになり、単一 shape type でもインスタンスごとにリサイズ可否を変えられる（後方互換）。判定を一本化する `isShapeResizable(def, shape)` を追加・エクスポート。
  - `@edv4h/usketch-tool-helpers` / `@edv4h/usketch-plugin-tool-select`: リサイズハンドルの当たり判定・カーソル・選択オーバーレイのハンドル表示が `isShapeResizable` 経由で述語形式を尊重するように更新。

- Updated dependencies [3e53816]
- Updated dependencies [d68e0ca]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-tool-helpers@0.3.1
  - @edv4h/usketch-core@2.0.2
  - @edv4h/usketch-store@3.0.1

## 3.0.1

### Patch Changes

- Updated dependencies [ae536ff]
- Updated dependencies [0874a59]
- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-tool-helpers@0.3.0
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
  - @edv4h/usketch-tool-helpers@0.2.1

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

### Patch Changes

- 3238756: Selection foreground (selection UI) を外部から差し替え可能にする API を追加 (#577)。
  - `createApp({ selectionForeground: { render } })` ホスト向けオプション (priority 100 で登録)。
  - `ctx.ui.registerSelectionForeground({ id, priority, render })` プラグイン向け registrar。
  - 解決ルール: priority 数値大が勝ち、同値なら last-wins。
  - `usketch-plugin-tool-select` は priority 0 のデフォルトとして自己登録 (`id: "tool-select-default"`)。挙動・互換性は維持。
  - canvas-engine は active エントリを内部 layer `__selection-foreground` として動的にマウント。

  詳細は `guides/selection-foreground` (en/ja) を参照。

- 9b64581: Add `diffShape` / `bidiffShape` utilities to `@edv4h/usketch-shared` and migrate `tool-select` to use them.

  These helpers compute the field-level diff between two shapes of the same type without knowing the concrete shape type at compile time — the dynamic field iteration that `tool-select` needs for resize undo/redo. The `Record<string, unknown>` cast required to iterate `ShapeData` fields is now encapsulated in the utility, so the type escape is confined to one place instead of being repeated at every call site.

  Follow-up to #582 / #575 — eliminates the three local `as unknown as Record<string, unknown>` casts that the `[key: \`x-${string}\`]: unknown`index signature change introduced in`tool-select`.

- 5db18d6: Issue #576: tool 用の state machine helper を新パッケージ `@edv4h/usketch-tool-helpers`
  に切り出した。

  `plugin-tool-select` 内部で 1000 行超に渡って手書きされていた drag / resize /
  rotate / marquee / hover の state machine を、再利用可能な session API として
  公開する。

  新公開 API:
  - `startDragSession` — 移動 (子孫の自動追従、snap callback、`commit()` で `createMoveShapesCommand` を返却)
  - `startResizeSession` — single + multi の discriminated union。8 方向ハンドル、
    flip 検出、`def.applyBounds()` フック対応
  - `startRotateSession` — atan2 ベースの角度計算、shift で 15° snap、子要素の剛体回転
  - `startMarqueeSession` — intersect / contain（alt 切替）、最小ドラッグ距離フィルタ
  - `trackHover` / `findShapeAtPoint` — handle / shape body の hit-test 純関数
  - 既存の `resize-utils.ts` の関数群（`findHandleAtScreenPoint`、
    `getCursorForHandle`、`computeMultiResizeUpdates` 等）を helper パッケージ
    経由で公開

  `plugin-tool-select` 側は session 呼び出し形式に書き換え済み。挙動・パブリック
  API・undo 履歴は完全互換 (内部リファクタのみ)。

  `@edv4h/usketch-shape-utils` と同じく `@edv4h/usketch-shared` + `@edv4h/usketch-store`
  にしか依存しないので、weboard などの外部リポジトリからもプラグインを介さず
  import できる。

  docs ガイド (英語 / 日本語) に「Reusable Session Helpers」セクションを追加し、
  ドラッグで矩形を描画する最小カスタムツール例を掲載した。

  参照: Issue #576

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
- Updated dependencies [5db18d6]
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-core@1.1.0
  - @edv4h/usketch-store@2.0.0
  - @edv4h/usketch-tool-helpers@0.2.0

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
