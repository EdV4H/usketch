# @edv4h/usketch-plugin-voting

## 2.1.5

### Patch Changes

- Updated dependencies [06f3ef8]
  - @edv4h/usketch-sync@1.3.0

## 2.1.4

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0

## 2.1.3

### Patch Changes

- 0b30d54: ライブ・セッション基盤 Phase 2: クライアント投票プラグイン（HUD UI）＋旧 voting 廃止

  Phase 1 のサーバー権限セッション基盤を、実際にブラウザで使えるクライアントプラグインとして公開。UUI は方針どおり Control HUD に登録（独自ツールバー/パネルは作らない）。
  - 新パッケージ `@edv4h/usketch-plugin-session`: `createSessionPlugin({ wsProvider, userId, boardId })`。
    - `session-client`: `MSG_SESSION` チャネル（`sendSession`/`onSession`）をラップし、公開 `SessionView` と自分の private state をローカルミラー。接続/再接続時に自動 `sync`（途中参加・再接続で現状態へ追従）。サーバーが権威なので UI は intent 送信＋再描画のみ。
    - HUD パネル「セッション」: 投票作成フォーム（質問・最大4選択肢・秘密投票・複数選択、各項目にラベル/placeholder）、進行中投票のライブ tally バー、自分の投票ハイライト。
    - host の投票ライフサイクル: 「締める」= 集計を締切（結果は締切表示で残す）、締切後に「終了」= 全員のパネルから削除。`session-protocol` に host 専用 `end` メッセージを追加（サーバーが `ended` を配信してセッションを除去）。
    - UI は HUD パネルに一本化。汎用アクション（`ctx.actions`）はラベル無しの入力列になり多項目フォームには不向きなため、create アクションは登録しない。
    - スタイルはアプリのデザイントークン（`--bg-*`/`--fg-*`/`--border-*`/`--u-1` 等の CSS 変数）で構成し、Control HUD にライト/ダーク両対応で馴染む。host でないカードには「主催: … ／ あなた: …」を表示して権限の所在を明示（anonymous 接続などの取り違えを可視化）。
    - `wsProvider` 無し（ローカルボード）ではサーバー権限が前提のため no-op。
  - web(apps/web): cloud board で `createSessionPlugin` を登録。
  - `@edv4h/usketch-plugin-voting`: `createVotingPlugin` を `@deprecated` 化（blind-relay で永続状態を持たず重複回避・遅参不可のため）。web からは未登録。

  クライアントミラーの単体テスト10件（state/private/ended/error 適用・sync-on-connect・送信フレーム）。

- 03a3345: ライブ・セッション基盤を「**汎用フレームワーク ＋ 外部イベント型**」構成に

  Canvas 上で他ユーザーに「イベント」を発生させる共有インタラクティブ・セッションを、
  特定の活動（投票）を焼き込まず、**基盤に各自がイベント型を足せる**設計にした。サーバー
  権限モデルなので、イベント型は **サーバー部（`ServerSessionType`）＋ クライアント部（UI
  登録）のペア**として1パッケージにまとめる（tldraw の ShapeUtil 登録を両層でやる形）。
  - `@edv4h/usketch-session-protocol`: 封筒を**型非依存**に汎用化（`SessionType = string`、
    `public`/private `data`/`action`/`config` は `unknown`）。サーバー拡張契約
    `ServerSessionType`（init/reduce/privateFor/close ＋ 自己記述する `type` id）をここへ移設。
  - `@edv4h/usketch-plugin-session`: **フレームワーク化**。汎用 `session-client`（`act` 中心・
    投票非依存）＋ HUD パネルの外枠＋クライアント型レジストリ。`createSessionPlugin({ types })`
    に登録された各 `ClientSessionType`（`renderCard`/`renderCreateForm`）へ描画を委譲。基盤は
    もう voting を知らない。`SessionManager` は型レジストリを注入で受け取る。
  - 新パッケージ `@edv4h/usketch-session-voting`: 投票を**最初の外部イベント型**として実装。
    `./server`（`votingServerType`）と `./client`（`votingClientType`）の2エントリで、
    `apps/server` と `apps/web` がそれぞれ import。サーバーバンドルに React は入らない。
  - `@edv4h/usketch-plugin-voting`: 旧 blind-relay 実装は引き続き `@deprecated`。

  新しいイベント型（チュートリアル/カードゲーム）は、この基盤に `ServerSessionType` ＋
  `ClientSessionType` のペアを1パッケージ足すだけで追加できる。既存の投票の挙動・単体テスト
  （サーバー13・クライアント10）は不変。

- Updated dependencies [6a1e9b9]
  - @edv4h/usketch-sync@1.2.0

## 2.1.2

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0

## 2.1.1

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0

## 2.1.0

### Minor Changes

- 733df55: 各プラグインの独自 UI を Control HUD（`ctx.actions` / `ctx.hud.registerSettings`）へ移行し、オンキャンバスの独自コントロールを削減。
  - map: `MapPalette` / `RangeErasePalette` を撤去し、モード・地形・アイコン・領域塗りの除外・生成・拠点・範囲消去対象を HUD の settings/actions に移行（`registerMapHud`）。マップツールのキャンバス操作は不変。
  - reactions: 絵文字選択を HUD action 化（数字キーは維持）。
  - voting: 「投票を作成」を HUD の param-form action に。
  - shape-group: グループ化/解除を HUD action に（選択状態で活性、ショートカット維持）。
  - canvas-filter: 常設インジケータを撤去し、フィルタ設定を開く/解除/タイムトラベル終了を HUD action に。
  - avatar: ツール切替と重複するラジアルメニューを撤去（ツール切替は HUD のツール一覧に一本化）。アバター描画は不変。

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0

## 2.0.8

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0

## 2.0.7

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0

## 2.0.6

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
- Updated dependencies [4148a9c]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-sync@1.1.0

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

- fa92cf8: **BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

  Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

  Fixes #469.

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

## 1.0.1

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
  - @edv4h/usketch-sync@1.0.0
