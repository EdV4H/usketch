# @edv4h/usketch-shared

## 4.12.0

### Minor Changes

- 102a284: canvas-engine: タッチ（マルチポインタ）ジェスチャ対応 (#1004)。

  `Canvas` が 2 本指を `pointerId` で追跡し、**ピンチ＝ズーム / 2 本指ドラッグ＝パン**を `store.zoomTo`（中点中心・距離比）/ `store.panBy`（中点移動）で viewport に反映（wheel と同じ経路・クランプ共有）。ジェスチャ中はツールへの配送を抑止し、全指が離れるまで再開しない。単一タッチは「移動 or タップ確定まで pending」にして 2 本目の指が来ても描画/選択が誤発火しない。Safari の `gesturestart`/`gesturechange` は握り潰しから**ズーム変換**へ置換（ブラウザ標準ズームの抑止は維持）。
  - **`CanvasPointerEvent`** に `pointerId?` / `pointerType?` を追加（optional・後方互換）。ツールがタッチ/ペン/マウスを区別可能に。
  - **`Canvas`** に `touchGestures?: boolean` prop（既定 `true`）。マウス/ペン/wheel の既存挙動は不変（touch のみ新経路）。ジェスチャ中は `canvas:gesture` イベントを emit。
  - ジェスチャ計算 `gestureStep` / `pointerDistance` / `pointerMidpoint` を純関数として公開・ユニットテスト。

## 4.11.0

### Minor Changes

- 5e301c0: shared: `defineService` — 型付きサービスハンドルで `ctx.services` / `app.services` を扱う

  プラグインが「ホスト向けの操作 API」を HUD 非依存で公開するための標準シーム。`defineService<T>(key)`
  が `ServiceHandle<T>`（`key` ＋型付き `provide`/`get`/`has`）を返す。provider と consumer が
  key・型でズレず、`ctx.services`（plugin）と `app.services`（host）は同一 registry なので同じ
  アクセサで両方に使える。プラグイン不在時は `get` が `undefined`（optional 扱い）。

  用途は docs/plugin-system-design.md を参照（操作ロジックは HUD クロージャに埋めず純関数化し、
  ホスト向けは `defineService` で公開する規約）。

## 4.10.0

### Minor Changes

- 9747462: レイヤー登録に衝突回避オプション `avoidCollision` を追加

  プラグインは他プラグインが使う `order` 値を認知できず衝突しがち（現状 `84`/`85`/`90` などで重複多数）。`avoidCollision: true` を指定すると、`order` を「希望値」として扱い、既に同じ実効orderが埋まっていれば空きスロットまで押し上げて一意な順序を割り当てる（開発サーバーのポート確保方式）。押し上げ幅は `collisionStep` で指定可能（既定は帯内に留まる微小値、`1` で整数ポート方式）。未指定レイヤーの挙動は不変。

## 4.9.0

### Minor Changes

- bba174a: 回転まわりの選択 UI を修正。
  - **複数選択したシェイプを回転できるようにした**。従来は回転ハンドルの検出が単一選択限定で、複数選択（グループ化していない選択）は回転できなかった。複数選択のバウンディングボックスの角外側に回転ゾーンを追加し、選択中の全シェイプを共通中心まわりに剛体回転する `startMultiRotateSession` を追加（コネクタは端点回転、undo/redo 対応）。ホバー時は回転カーソルも出る。
  - **図形のコネクタ・アンカーハンドル（上下左右）が図形の回転に追従するようにした**。従来は回転した図形でもアンカー（コネクタの始点/接続点）が軸平行の辺の中点に出ていて、辺から外れていた。`getAnchorPoint` / `clampToShapeEdge` を回転対応にし（ローカル座標で計算 → 中心まわりに回転して world 座標へ）、選択時の外側オフセットも辺の法線方向へ回すようにした。これで回転済み図形からも正しい辺の位置でコネクタを繋げられる。
  - **グループ回転でコネクタが崩れる不具合を修正**。コネクタは形状を端点（絶対座標）で定義するため、グループ回転で `rotation` を焼き込むと二重変換で線・ハンドルが崩れていた。`ShapeDefinition.rotate` フック（`move` と対）を追加し、コネクタは端点を回して `rotation` は据え置く（`rotateConnector`）。
  - **回転ハンドルのカーソルを角ごとの回転アイコンにした**。従来は全ての角で `grab` 固定だったが、掴んだ角（ne/se/sw/nw）＋シェイプの現在回転角に合わせた回転カーソル（150°円弧＋接線方向ダブル矢じりの SVG data URI）を表示する。`tool-helpers` に `getRotationCursor(corner, rotationDeg)` を追加し、`findRotationHandleAtScreenPoint` はどの角かも返すようになった。

## 4.8.0

### Minor Changes

- 6c6702b: ロジック起点のビューポート移動（ズーム変更・特定位置へのジャンプ・zoom-to-fit）をスムーズにアニメーションさせ、デフォルト ON にした。連続的なインタラクション（ホイールズーム・ドラッグパン・ミニマップドラッグ）は従来どおり即時。
  - store: `animateViewportTo(target, opts?)` を追加（rAF による eased 補間、`prefers-reduced-motion`・rAF 不在・無効時は即時フォールバック、割り込みは即時系メソッドが cancel）。`fitToBounds` は既定でアニメ化。`createBoardStore({ viewportAnimation })` と `setViewportAnimation` / `getViewportAnimation` で enabled/duration/easing を調整可能（既定: 有効・350ms・ease-in-out-cubic）。
  - shared: 各プラグインが個別実装していたジャンプ計算を共通 helper `centerOnWorld` / `zoomBy` / `zoomToLevel` / `fitContent` / `screenCenterWorld` / `getScreenSize` に集約（すべて既定でアニメ）。
  - keyboard-shortcuts / tool-vim / whistle / follow-me / debug-hud を共通 helper に移行。follow-me は追従の応答性のため短めのアニメ（180ms）。

## 4.7.0

### Minor Changes

- 359d732: ショートカット基盤を拡張（後方互換）。
  - combo に `Mod` トークンを追加。プラットフォームのアクセラレータ（macOS=Cmd / その他=Ctrl）に正規化されるため、`Mod+Z` の 1 定義で Cmd+Z・Ctrl+Z 両対応になる。
  - `ShortcutRegistry.register(combo, callback, meta?)` にメタデータ（`label` / `category`）を追加。
  - `ShortcutRegistry.list()` を追加。登録済みショートカット（combo + meta）を返し、ホスト側でチートシートや設定 UI を組めるようにする。
  - コアの Undo/Redo を `Mod+Z` / `Mod+Shift+Z` へ移行（メタ付き）。

## 4.6.0

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

## 4.5.0

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

## 4.4.0

### Minor Changes

- a7b3e78: hover 中の shape を選択インジケータ層から参照できるようにした（#664）。selection と同じ仕組みで、カスタム `SelectionForeground` が shape 種別ごとに hover インジケータを差し替えられる。
  - `LayerRenderContext.hoveredShapeId: string | null` を追加（`selection` の hover 版）。
  - `BoardStore` に `getHoveredShapeId()` / `setHoveredShapeId()` を追加（UI シグナルとして store が単一の真実源で保持。`subscribe` で購読可能）。
  - `usketch-plugin-tool-select` は hover をプラグイン内部の module state ではなく store に書き込むようにし（`hover-state.ts` を撤去）、canvas-engine が `LayerRenderContext` に載せる。hover を追跡しないツールでは `null`。
  - hover 変更は主 subscribe チャネルに載るが、`useSyncExternalStore` のセレクタ等価判定により selection/shapes の購読者は再描画されない。

## 4.3.0

### Minor Changes

- 05b6e0b: 任意 shape に貼り付いて追従する「アタッチ可能な子」shape をネイティブ対応（#660）。container 機構（親側 opt-in）の逆方向として、child 側で opt-in する `attachable` 宣言を追加。付箋・カードなど非コンテナ shape にも乗せると貼り付き、親移動に追従する。bespoke なドラッグ乗っ取りが不要になり、素の select tool 由来の選択・リサイズ・回転を保てる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.attachable?: { toAny?, follow?, hitTest? }` を追加（`container` と対になる child 側宣言。各値は `boolean | ((data) => boolean)` 述語形）。評価ヘルパー `isAttachable` / `isAttachableFollow` / `getAttachableHitTest` / `attachableAcceptsTarget` を追加。
  - `@edv4h/usketch-tool-helpers`: `collectSelectionWithDescendants` を拡張し、親が非コンテナでも `attachable.follow` を宣言した子は親移動に追従（native move-follow の child 側 opt-in、プラグイン不要）。attachable shape が無いボードでは挙動・コスト共に従来と同一。
  - `@edv4h/usketch-store`: child 主導の reactive attach util `createAttachableAttacher` を追加（`shapes:move-end` を購読し、`hitTest`（center/contain）と `toAny` フィルタで front-most な対象に parentId を付与/解除、循環ガード・undo 対応）。`createContainmentAttacher` は不変。
  - `@edv4h/usketch-plugin-container`: `createAttachablePlugin()` を追加（同 subsystem のため専用パッケージではなく本プラグインから export）。`attachable` を宣言した shape の attach-on-drop を `createAttachableAttacher` で駆動する独立プラグイン（`createContainerPlugin` とは別に register 可能）。follow はプラグイン無しでも native に効き、attach を使うアプリがこの `createAttachablePlugin()` を register する。

## 4.2.0

### Minor Changes

- 8d341b3: コンテナ機構を type 文字列のハードコードからフラグ駆動に開放し、独自コンテナ型シェイプを可能にした（#647）。
  - `@edv4h/usketch-shared`: `ShapeDefinition.container?: { enabled?, selectableChildren?, autoAttach?, layout? }` を追加（各値は `resizable` 同様の `boolean | ((data) => boolean)` 述語形）。評価ヘルパー `isShapeContainer` / `hasSelectableChildren` / `isContainerAutoAttach` / `getContainerLayout` を追加。
  - `@edv4h/usketch-tool-helpers`: `findShapeAtPoint` / marquee / descendant collection の `frame`/`island`/`group` 型ハードコードを撤廃し、`container` フラグ駆動に。frame/island 相当の子は個別選択、group 相当は親ごと選択。
  - `@edv4h/usketch-store`: 汎用 `createContainmentAttacher`（重なりで parentId 付与/解除、循環ガード、undo 対応）を追加。`createCollisionWatcher` に `isContainer` 述語オプションを追加。
  - `@edv4h/usketch-plugin-snap`: `SnapSettings.excludeTargets`（`snap:configure` 経由）を追加。該当シェイプは吸着先候補からも被スナップからも除外。
  - `@edv4h/usketch-plugin-container`（新規）: `container` 定義を持つシェイプのアタッチ・整列（`container.layout`、`stackLayout`/`gridLayout` 同梱）・スナップ除外を `onMutation`/イベントで駆動。
  - `@edv4h/usketch-plugin-shape-frame`: `container: { selectableChildren: true, autoAttach: true }` を付与し、独自の `autoReparent` を撤去して container プラグインの共有アタッチャに一本化。
  - `@edv4h/usketch-plugin-shape-group` / `@edv4h/usketch-plugin-shape-island`: `container` を付与（後方互換。group は selectableChildren なし＝従来の親ごと選択、island は selectableChildren あり）。

## 4.1.0

### Minor Changes

- 3e53816: カード / デッキをリサイズ不可（サイズ固定）にできるオプションを追加（#626）。
  - `@edv4h/usketch-plugin-shape-card`:
    - `createCardPlugin({ resizable?: boolean })` — プラグイン全体の既定（既定 `true`）。
    - `CardTypeDefinition.resizable?: boolean` — card-type 単位の指定（プラグイン全体より優先）。「value カードは固定、トランプは可変」のような出し分けが可能。
    - 指定時、`card` / `card-deck` の `ShapeDefinition.resizable` に per-instance で反映される。利用側で `resize` / `applyBounds` を no-op に差し替えるハックが不要になる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.resizable` が `boolean` に加えて述語 `(data) => boolean` を受け付けるようになり、単一 shape type でもインスタンスごとにリサイズ可否を変えられる（後方互換）。判定を一本化する `isShapeResizable(def, shape)` を追加・エクスポート。
  - `@edv4h/usketch-tool-helpers` / `@edv4h/usketch-plugin-tool-select`: リサイズハンドルの当たり判定・カーソル・選択オーバーレイのハンドル表示が `isShapeResizable` 経由で述語形式を尊重するように更新。

## 4.0.0

### Major Changes

- fa92cf8: **BREAKING (TypeScript)**: `BoardStore` interface gains three required members — `getDefaultToolId()`, `setDefaultToolId(id)`, `resetToDefaultTool()`. Code that implements or mocks `BoardStore` (or `BoardState`) must add these members.

  Plugins that want to return to the default tool after use now call `store.resetToDefaultTool()` instead of the previous hardcoded `setActiveToolId("select")` pattern. Consumers can change the default with `store.setDefaultToolId(id)` (or read it via `store.getDefaultToolId()`). The initial default remains `"select"`, and a new `default-tool:changed` mutation event is emitted when it changes.

  Fixes #469.

- ad8e01d: `StoreEvent` を型付きの判別ユニオンにし、`shape:updated` に before/after を載せるようにした（#615）。

  **Breaking changes**: `StoreEvent` がオープンな `{ type: string; payload?: unknown }` から閉じたリテラル union になったため、未知の `type` 比較（例: `event.type === "foo"` が TS2367）や `StoreEvent` を自前で構築していたコードはコンパイルエラーになり得る。`BoardStore.updateShape` の `updates` も `Partial<Omit<ShapeData, "id">>` に絞られたため、`updateShape(id, { id })` のような呼び出しは型エラーになる。
  - `StoreEvent` を store が発行する全イベント種別（`shape:added` / `shape:removed` / `shape:updated` / `selection:changed` / `tool:changed` / `default-tool:changed` / `shapes:z-index-initialized` / `viewport:changed` / `style:changed`）を網羅する**閉じた**判別ユニオンに変更。オープンな文字列フォールバックは持たない（混ぜると `"shape:updated"` も `string` に代入可能になり narrowing が効かなくなるため）。`event.type` で絞り込むと `payload` が正しく型付けされる。
  - `type` リテラルの型 `StoreEventType` を追加・エクスポート。
  - シェイプ系イベントの payload を `ids: string[]` に正規化（後方互換のため単一 `id` も併載）。
  - `shape:updated` の payload に `before` / `after`（変更前後の `ShapeData`）を追加し、`ShapeChange` 型として切り出してエクスポート。親の移動に子を追従させる等の購読側が、自前で前回位置を保持しなくても差分を取れるようになり、ドラッグ初手のデルタ取りこぼし（first-step-miss）を防げる。
  - 既存の `event.payload as { id }` 形の購読はそのまま動作（後方互換）。

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

- 9b64581: Add `diffShape` / `bidiffShape` utilities to `@edv4h/usketch-shared` and migrate `tool-select` to use them.

  These helpers compute the field-level diff between two shapes of the same type without knowing the concrete shape type at compile time — the dynamic field iteration that `tool-select` needs for resize undo/redo. The `Record<string, unknown>` cast required to iterate `ShapeData` fields is now encapsulated in the utility, so the type escape is confined to one place instead of being repeated at every call site.

  Follow-up to #582 / #575 — eliminates the three local `as unknown as Record<string, unknown>` casts that the `[key: \`x-${string}\`]: unknown`index signature change introduced in`tool-select`.

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
