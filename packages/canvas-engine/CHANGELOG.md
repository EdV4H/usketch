# @edv4h/usketch-canvas-engine

## 1.3.2

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-core@2.3.1

## 1.3.1

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-core@2.3.0

## 1.3.0

### Minor Changes

- 759e7be: シェイプの **表示/非表示 (`hidden`) と ロック (`locked`)** をコアのシェイプ・プリミティブとして追加（Figma レイヤーパネル相当の基盤ロジック。パネル UI は含まない）。
  - `ShapeData` に `hidden?` / `locked?` を追加。`hidden` は描画・当たり判定・選択・変形の対象外、`locked` は描画はされるが選択・移動・リサイズ・回転・削除の対象外。いずれも**祖先へカスケード**（グループ/フレームを隠す/ロックすると子孫も実効的にそうなる）。
  - 述語ヘルパー: `isShapeHidden`/`isShapeLocked`（自フラグ, `@edv4h/usketch-shared`）、`isEffectivelyHidden`/`isEffectivelyLocked`（祖先解決, `@edv4h/usketch-store`）。
  - コマンド: `createSetHiddenCommand`/`createSetLockedCommand`（id 指定・undo/Yjs 同期対応。ロック中シェイプは canvas 上で選べないため id で切替）。
  - エンジンが尊重: 描画（全レンダラ経路）で hidden を除外、ヒットテスト・矩形選択・リサイズ/回転ハンドル・全選択・削除で hidden+locked を除外。AI シリアライズにも反映。

- 4764580: **画角外シェイプの LOD 表示（per-shape viewport LOD）** を追加。カメラ画角の外にあるシェイプを簡略（LOD）描画してパフォーマンスを改善する。
  - `LayerRenderContext` に `viewportBounds`（world 座標の可視領域）を追加。`canvas-engine` が `ResizeObserver` で計測した canvas サイズと viewport から算出し全レイヤーへ供給（GPU/minimap/カリングでも再利用可）。
  - `@edv4h/usketch-shared` に純ヘルパー `getShapeAABB` / `rectsIntersect` / `scaleRectAboutCenter` / `isShapeOutsideViewport` を追加。
  - `dom-renderer` の per-shape LOD 判定を「グローバル LOD（zoom/count/fps）**OR** 画角外」に拡張。画角外は既存の `simplifiedComponent ?? LodFallback` で簡略描画。
  - `createDomRendererPlugin({ viewportLod })` で設定可能（既定 ON）。`viewportLod.ratio` = 本描画とする画角の割合（**既定 1.2**＝120% でポップイン緩衝、1.0=画角ちょうど、0.5=中央50%のみ本描画）。`false` で無効化。
  - **実行中に調整可能**: `SET_VIEWPORT_LOD_EVENT`（`renderer:set-viewport-lod`, `{ enabled?, ratio? }`）を emit すると即座に反映（`layers:changed` で再描画）。web アプリは Control HUD（バッククォートで開くパネル）の「表示」グループに ON/OFF トグルと本描画範囲(%)の入力を追加し、値を localStorage に永続化。
  - LOD は描画のみ。シェイプ data は不変で、画角外でも全件が snapshot/同期に残る。

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-core@2.2.0

## 1.2.1

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [51216e7]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-core@2.1.0

## 1.2.0

### Minor Changes

- a7b3e78: hover 中の shape を選択インジケータ層から参照できるようにした（#664）。selection と同じ仕組みで、カスタム `SelectionForeground` が shape 種別ごとに hover インジケータを差し替えられる。
  - `LayerRenderContext.hoveredShapeId: string | null` を追加（`selection` の hover 版）。
  - `BoardStore` に `getHoveredShapeId()` / `setHoveredShapeId()` を追加（UI シグナルとして store が単一の真実源で保持。`subscribe` で購読可能）。
  - `usketch-plugin-tool-select` は hover をプラグイン内部の module state ではなく store に書き込むようにし（`hover-state.ts` を撤去）、canvas-engine が `LayerRenderContext` に載せる。hover を追跡しないツールでは `null`。
  - hover 変更は主 subscribe チャネルに載るが、`useSyncExternalStore` のセレクタ等価判定により selection/shapes の購読者は再描画されない。

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-core@2.0.5

## 1.1.5

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-core@2.0.4

## 1.1.4

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-core@2.0.3

## 1.1.3

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-core@2.0.2

## 1.1.2

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-core@2.0.1

## 1.1.1

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0
  - @edv4h/usketch-core@2.0.0

## 1.1.0

### Minor Changes

- 899b4b2: External Content Handler プラグイン API を追加 (#578)。
  - `ctx.externalContent.register({ id, kind, match, handle, order })` を新設 (`kind: "file" | "url" | "text"`)。
  - 解決ルール: kind フィルタ → match true のうち `order` 最大 1 件のみ実行。同値 last-wins。selection-foreground と同じ意味論。
  - canvas-engine が drop / paste の `DataTransfer` / `ClipboardEvent` を `ExternalContent` に正規化。document scope の paste listener を内部で張る (INPUT/TEXTAREA/contentEditable はスキップ)。
  - 既存 `canvas:drop` event は後方互換のため残置 (新コードは `ctx.externalContent` を推奨)。
  - `usketch-plugin-shape-image` が「画像 file → image shape」の default を `order: 0` で自己登録。
  - `usketch-plugin-ai-image` は drop / paste path を撤去。`image:upload` 経由のファイルピッカーは維持。

  詳細は `guides/external-content` (en/ja) を参照。

- 3238756: Selection foreground (selection UI) を外部から差し替え可能にする API を追加 (#577)。
  - `createApp({ selectionForeground: { render } })` ホスト向けオプション (priority 100 で登録)。
  - `ctx.ui.registerSelectionForeground({ id, priority, render })` プラグイン向け registrar。
  - 解決ルール: priority 数値大が勝ち、同値なら last-wins。
  - `usketch-plugin-tool-select` は priority 0 のデフォルトとして自己登録 (`id: "tool-select-default"`)。挙動・互換性は維持。
  - canvas-engine は active エントリを内部 layer `__selection-foreground` として動的にマウント。

  詳細は `guides/selection-foreground` (en/ja) を参照。

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
