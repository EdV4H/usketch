# @edv4h/usketch-core

## 2.4.1

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0

## 2.4.0

### Minor Changes

- 9747462: レイヤー登録に衝突回避オプション `avoidCollision` を追加

  プラグインは他プラグインが使う `order` 値を認知できず衝突しがち（現状 `84`/`85`/`90` などで重複多数）。`avoidCollision: true` を指定すると、`order` を「希望値」として扱い、既に同じ実効orderが埋まっていれば空きスロットまで押し上げて一意な順序を割り当てる（開発サーバーのポート確保方式）。押し上げ幅は `collisionStep` で指定可能（既定は帯内に留まる微小値、`1` で整数ポート方式）。未指定レイヤーの挙動は不変。

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0

## 2.3.2

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0

## 2.3.1

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0

## 2.3.0

### Minor Changes

- 359d732: ショートカット基盤を拡張（後方互換）。
  - combo に `Mod` トークンを追加。プラットフォームのアクセラレータ（macOS=Cmd / その他=Ctrl）に正規化されるため、`Mod+Z` の 1 定義で Cmd+Z・Ctrl+Z 両対応になる。
  - `ShortcutRegistry.register(combo, callback, meta?)` にメタデータ（`label` / `category`）を追加。
  - `ShortcutRegistry.list()` を追加。登録済みショートカット（combo + meta）を返し、ホスト側でチートシートや設定 UI を組めるようにする。
  - コアの Undo/Redo を `Mod+Z` / `Mod+Shift+Z` へ移行（メタ付き）。

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 2.2.0

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

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 2.1.0

### Minor Changes

- 8c1df08: Debug HUD をプラグイン操作の**汎用コントロール面**に昇格。ホストアプリに専用 UI を足さなくても、プラグイン操作を HUD だけで駆動できる。
  - **Action レジストリ新設**（`@edv4h/usketch-shared` / `@edv4h/usketch-core`）: `PluginContext.actions` / `AppInstance.actions` を追加。プラグインが `ctx.actions.register({ id, label, group?, icon?, params?, run, isActive?, isEnabled? })` で操作を宣言でき、`tools`/`shapes` と同じく `getAll()`/`getOrdered()` で列挙可能・`subscribe` で変更通知。`ActionParam` は `string|number|boolean|color|enum`。
  - **Debug HUD**（`@edv4h/usketch-plugin-debug-hud`）: 新「Controls」パネルを追加。Tool palette（`tools.getOrdered()` → `setActiveToolId`）、Actions（レジストリからボタン/パラメータフォームを自動生成）、任意イベント emit コンソール（未移行操作のフォールバック）、既定スタイル編集 / Clear canvas。DEV 限定を解除し本番でも `` ` `` でトグル可能に。
  - **主要プラグインを Action 登録に移行**: freedraw（ペン種/色/太さ/消しゴム）・snap（On/Off）・bg-grid（背景 grid/dots/none）・card（card-type 選択、選択カードの flip/手札、選択デッキの draw/shuffle）・sticky（色）。挙動は既存イベントを emit するだけで不変。

  残り（wireframe/domain/basic-shape のサブタイプ、connector のプロパティ）は同一パターンで追随予定。既存 Demo UI は撤去せず共存。

- 1b75eb1: 新規: Markdown → 複数 shape 変換プラグイン `usketch-plugin-markdown-to-shape` + 変換レジストリ。
  - **shared / core**: `PluginContext`（と `AppInstance`）に `markdownConverters` レジストリを追加（`createMarkdownConverterRegistry`）。`MarkdownConverter { nodeTypes/match, order?, convert(node,ctx) → MarkdownShapeSpec[] }` を型で提供。解決は type/match フィルタ → order 最大 → 後勝ち。mdast 非依存の `MarkdownNode` 型で shared を汚さない。
  - **markdown-to-shape プラグイン**: `remark-parse + remark-gfm` で source を mdast にし、top-level ブロックごとに登録 converter（無ければ **`markdown` shape へフォールバック**＝生ソースを slice して保持）で shape 化、縦フローで配置し 1 undo で置換。Control HUD の Action「🧩 Markdown を図形に分解」（markdown 単一選択時のみ）。他の shape プラグインに一切依存しない（IoC：変換先が自分を登録）。
  - **mermaid フローチャート分解**: `mermaid` の `graph`/`flowchart` を **rectangle + text ノード + connector** の編集可能な native 図に分解（`createMermaidFlowchartConverter`）。自前パーサ + `@dagrejs/dagre` レイアウト（同期）で、`ctx.origin` から絶対配置・connector は node id で接続（=移動に追従）。非 flowchart / パース失敗は markdown shape にフォールバック。
  - **MarkdownShapeSpec に `id`/`x`/`y`、MarkdownConverterContext に `origin`** を追加。converter は「単発 spec」も「自前レイアウトのサブグラフ（自 id・絶対座標）」も返せる（orchestrator が枠に積む）。
  - **apps/web**: heading/paragraph/list/blockquote → text、mermaid → 図分解の adapters を `ctx.markdownConverters` に登録（table/code は markdown フォールバック）。プラグインは shape を import せず、app 側 adapter が橋渡し。

  将来 code/table 等の native shape を足す際は converter を登録するだけで良く、プラグイン本体の改変は不要。

- c7ff8d9: プラグイン間拡張点を汎用サービススロット化。`PluginContext` から機能専用の `markdownConverters` フィールドを削除し、代わりに汎用の `services`（`ServiceRegistry`: `provide`/`get`/`has`）を追加。Markdown→shape 変換レジストリは core から `usketch-plugin-markdown-to-shape` へ移動し、同プラグインが `ctx.services` に `markdown-converters` キーで provide して own するようになった。カーネル契約（core）が単一機能の関心を持たなくなり、今後の拡張点（export/import 等）も同じスロットに載せられる。

  BREAKING: `ctx.markdownConverters` を使っていたコードは `getMarkdownConverters(ctx)`（`@edv4h/usketch-plugin-markdown-to-shape` からエクスポート）に置き換える。provide 側（プラグイン）は consumer より先に setup される必要がある。

### Patch Changes

- 51216e7: LOD（簡略描画）に切り替わるズーム閾値を緩和。ズーム 0.5（50%）で LOD 化＝早すぎて、まだ十分に読める倍率で図形が簡略表示になっていた。enter 0.5→0.25 / exit 0.7→0.4 に変更し、実際に細部が潰れる低倍率までは interactive 描画を維持する。ヒステリシス幅は据え置き。
- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0

## 2.0.5

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0

## 2.0.4

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0

## 2.0.3

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0

## 2.0.2

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0

## 2.0.1

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0

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

## 1.1.0

### Minor Changes

- 5766fa8: Fix severe FPS drop while dragging shapes when `debug-hud` is enabled.
  - `@edv4h/usketch-plugin-debug-hud` now coalesces event-log notifications via `requestAnimationFrame`, so a burst of `shape:updated` events during a drag triggers at most one HUD re-render per frame. The capture path is also gated on HUD visibility: while the HUD is hidden, the monkey-patched `emit` short-circuits to a single boolean read and pushes nothing into the logger.
  - `@edv4h/usketch-core` / `@edv4h/usketch-shared`: `EventBus` gains `pause()`, `resume()`, and `isPaused()`. `emit()` becomes a no-op while paused; `on()`/`off()` keep working so subscribers registered during a paused window receive events after resume. Provided as a general-purpose hook for callers that need to suspend delivery during hot paths.

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
