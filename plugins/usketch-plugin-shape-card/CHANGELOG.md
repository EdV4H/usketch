# @edv4h/usketch-plugin-shape-card

## 1.8.5

### Patch Changes

- 5916c16: Shape の 3D をコアのデータにしました（3D 標準対応 P4a、#1473）。絵は変わりません。
  
  - **shared**
    - `ShapeData.view3d`（stand / box / float、高さ、向き、影、当たり判定）を追加
    - 読み書きの純関数（`readShapeView3d`、`resolveShapeView3d`、`storedShapeView3d`、`shapeView3dPatch` など）を追加
    - `ShapeDefinition.view3d`（`modes` / `default` / `render3d`）を追加
    - 次のメジャーまで、書くときは `view3d` と `x-shape-3d` の両方に書きます。読むときは、まだ `x-shape-3d` があればそちらを読みます（古いクライアントはそちらにしか書かないため）
  - **core**: `ctx.shapes.configureView3d(type, view3d)` で、ホストが種別ごとの 3D を上書きできます（`getView3d` / `subscribeView3d` も追加。次のメジャーまで省略可）
  - **shape-3d**: 各種別の宣言とホストの上書きを読みます。`types` オプション・`registerType`・組み込みの表は、まだ宣言していない種別のため次のメジャーまで残します
  - **各 Shape プラグイン**: 自分の 3D を宣言します
    - rectangle・rounded-rect・sticky・card・frame・image は箱にもなれます
    - embed・openui は 3D にしません
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [4a81786]
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0
  - @edv4h/usketch-core@2.6.0
  - @edv4h/usketch-canvas-engine@1.6.0
  - @edv4h/usketch-store@3.12.0
  - @edv4h/usketch-shape-utils@2.4.6

## 1.8.4

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
- Updated dependencies [5adf284]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-core@2.5.0
  - @edv4h/usketch-canvas-engine@1.5.12
  - @edv4h/usketch-store@3.11.6
  - @edv4h/usketch-shape-utils@2.4.5

## 1.8.3

### Patch Changes

- Updated dependencies [735c4b4]
  - @edv4h/usketch-canvas-engine@1.5.11

## 1.8.2

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0
  - @edv4h/usketch-canvas-engine@1.5.10
  - @edv4h/usketch-core@2.4.13
  - @edv4h/usketch-store@3.11.5
  - @edv4h/usketch-shape-utils@2.4.4

## 1.8.1

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0
  - @edv4h/usketch-canvas-engine@1.5.9
  - @edv4h/usketch-core@2.4.12
  - @edv4h/usketch-store@3.11.4
  - @edv4h/usketch-shape-utils@2.4.3

## 1.8.0

### Minor Changes

- 7157bdf: デッキのシャッフル演出を host が差し込める `shuffleAnimation` を追加した（`createCardPlugin` の既定と `CardTypeDefinition` 個別の両方で指定でき、card-type 側が優先）。シャッフル時に `DeckMeta.shuffledAt`（epoch ms）を記録し、そこから `durationMs` の間だけ山札の厚みと一番上のカードを `render` の描画に差し替える（外枠と残枚数バッジはそのまま）。`shuffledAt` は shape と一緒に同期されるので全員の画面で同じ時刻から再生される。ドローでは `shuffledAt` を残し、シャッフルの Undo では消す（取り消しで演出を出さない）。1 枚以下のデッキのシャッフルは何もしない（同期も Undo 履歴も増やさない）。`render` は要素として描くので hooks を使える。指定しなければ従来どおり動かない。

## 1.7.14

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-canvas-engine@1.5.8
  - @edv4h/usketch-core@2.4.11
  - @edv4h/usketch-store@3.11.3
  - @edv4h/usketch-shape-utils@2.4.2

## 1.7.13

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-canvas-engine@1.5.7
  - @edv4h/usketch-core@2.4.10
  - @edv4h/usketch-store@3.11.2
  - @edv4h/usketch-shape-utils@2.4.1

## 1.7.12

### Patch Changes

- Updated dependencies [f9702b7]
- Updated dependencies [ca67108]
- Updated dependencies [a5dcd43]
  - @edv4h/usketch-canvas-engine@1.5.6
  - @edv4h/usketch-store@3.11.1

## 1.7.11

### Patch Changes

- Updated dependencies [33a4ef2]
- Updated dependencies [157cce0]
  - @edv4h/usketch-store@3.11.0

## 1.7.10

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
- Updated dependencies [6f3ef3b]
- Updated dependencies [9b3a0a1]
  - @edv4h/usketch-shared@4.19.0
  - @edv4h/usketch-shape-utils@2.4.0
  - @edv4h/usketch-store@3.10.0
  - @edv4h/usketch-canvas-engine@1.5.5
  - @edv4h/usketch-core@2.4.9

## 1.7.9

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0
  - @edv4h/usketch-canvas-engine@1.5.4
  - @edv4h/usketch-core@2.4.8
  - @edv4h/usketch-store@3.9.2
  - @edv4h/usketch-shape-utils@2.3.1

## 1.7.8

### Patch Changes

- 7856e60: feat(shape-image): 画像Shapeごとにリサイズ挙動を選べるようにした。`resizeMode`（`"keep-aspect"` 既定 / `"free"`）と、自由リサイズ時の収まり方 `fit`（`"contain"` 既定 / `"cover"` / `"fill"`）を追加し、Control HUD の「画像のリサイズ」から選択中の画像に設定できる。取り込み時に元画像の縦横比を `aspectRatio` として保存し、自由から比率固定に切り替えると枠をその比率に合わせる。操作は純関数 `setImageResizeMode` / `setImageFit` と `getImageApi` サービスで公開。`@edv4h/usketch-shape-utils` にアスペクト比固定リサイズの共有ヘルパー `createAspectResize` を追加し、card の `makeAspectResize` はそれを使うように変更（挙動は同じ）。
- Updated dependencies [083ff59]
- Updated dependencies [7856e60]
- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shape-utils@2.3.0
  - @edv4h/usketch-shared@4.17.0
  - @edv4h/usketch-canvas-engine@1.5.3
  - @edv4h/usketch-core@2.4.7
  - @edv4h/usketch-store@3.9.1

## 1.7.7

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0
  - @edv4h/usketch-store@3.9.0
  - @edv4h/usketch-canvas-engine@1.5.2
  - @edv4h/usketch-core@2.4.6

## 1.7.6

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0
  - @edv4h/usketch-canvas-engine@1.5.1
  - @edv4h/usketch-core@2.4.5
  - @edv4h/usketch-store@3.8.1

## 1.7.5

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0
  - @edv4h/usketch-canvas-engine@1.5.0
  - @edv4h/usketch-store@3.8.0
  - @edv4h/usketch-core@2.4.4

## 1.7.4

### Patch Changes

- Updated dependencies [1854e30]
  - @edv4h/usketch-store@3.7.0

## 1.7.3

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0
  - @edv4h/usketch-canvas-engine@1.4.1
  - @edv4h/usketch-core@2.4.3

## 1.7.2

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-canvas-engine@1.4.0
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-core@2.4.2
  - @edv4h/usketch-store@3.5.4

## 1.7.1

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-canvas-engine@1.3.5
  - @edv4h/usketch-core@2.4.1
  - @edv4h/usketch-store@3.5.3

## 1.7.0

### Minor Changes

- ec65083: カード手札を headless 化：host が独自の手札 UI を作れるように（#915）

  手札の状態（localStorage 永続・awareness 枚数共有・`card:*` アクション/イベント）はプラグインが持ちつつ、UI を host が差し替えられるようにした。後方互換（既定は現行どおり HUD の Hand パネルを出す）。
  - `CreateCardPluginOptions.hand` を追加:
    - `ui: "hud" | "none"`（既定 `"hud"`）— `"none"` で内蔵手札UIを一切登録しない（headless）。
    - `store`— host 生成の `HandStore` を注入し**同一インスタンス共有**（同一タブでも `subscribe` が発火）。
    - `onStore(store)` — プラグインが使う `HandStore` 実体を host へ渡す。
  - `createHandStore` / `HandStore` / `HandCardEntry` / `CardHandAwareness` を `index.ts` から export。
  - `card:to-hand` / `card-deck:draw-to-hand` / `card:play-from-hand` は headless でも従来どおり機能。

## 1.6.0

### Minor Changes

- 2319e60: 手札(Hand)を独自の下部固定トレイから Control HUD の「Hand」パネルへ移行

  プラグインUIはHUDに登録する方針に合わせ、独自トレイUI（`ctx.layers.register("card-hand")` の画面下部固定オーバーレイ）を廃止し、`ctx.hud.registerPanel` で「Hand」パネルとして登録。カード面サムネ＋「場に出す」ボタン＋他者枚数を HUD 内に表示する（挙動・privacyモデルは不変）。

### Patch Changes

- f4fd9d5: カードの出現演出（placement アニメ）を「手札から場に出したとき」だけに限定

  これまではデッキドロー / 複数ドロー / デッキをバラす / 手動ドロー / 移動でも placement アニメ（deal/slam 等）が再生されていた。演出が意味を持つ「手札プレイ」に絞り、`playCardFromHand` 以外の `emitPlacement` 呼び出し（`shapes:move-end` 購読を含む）を撤去した。

## 1.5.0

### Minor Changes

- 1b1be6d: デッキのユーティリティアクションを追加（Control HUD の Card グループに自動表示）
  - **Draw cards to board**（既定5枚・枚数パラメータ）: 山札上から N 枚を場に1列で展開。
  - **Draw to hand**（既定1枚・枚数パラメータ）: 山札上から N 枚を場に出さず直接ローカル手札へ。
  - **Spread deck**: 山札の全カードを回転なし・等間隔の折り返しグリッドで場に展開し、山札を空にする。

  いずれも単一コマンドで Undo/Redo 可能。純関数 `drawN`（deck.ts）と `gridPositions`（geometry.ts）を追加。

## 1.4.5

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-core@2.4.0
  - @edv4h/usketch-canvas-engine@1.3.4
  - @edv4h/usketch-store@3.5.2

## 1.4.4

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-canvas-engine@1.3.3
  - @edv4h/usketch-core@2.3.2
  - @edv4h/usketch-store@3.5.1

## 1.4.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0
  - @edv4h/usketch-canvas-engine@1.3.2
  - @edv4h/usketch-core@2.3.1

## 1.4.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-core@2.3.0
  - @edv4h/usketch-canvas-engine@1.3.1
  - @edv4h/usketch-store@3.4.1

## 1.4.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-core@2.2.0
  - @edv4h/usketch-store@3.4.0
  - @edv4h/usketch-canvas-engine@1.3.0

## 1.4.0

### Minor Changes

- 5f0b567: カード操作メニュー + 手札(hand)機能を追加（#671）。
  - **カード操作メニュー**: カード / 山札を選択すると近傍にフローティングメニュー（`ShapeAnchorOverlay`）が出る。カードは「めくる」「手札に入れる」、山札は「1枚ドロー」「シャッフル」。
  - **旧ダブルクリック操作は既定で撤去**: グローバルな `canvas:pointerdown` 監視の flip / デッキドローは select 等と競合しやすいため既定で無効化。`legacyDoubleClickActions: true` で後方互換復活。
  - **手札(hand)**: 「手札に入れる」で画面下部の固定トレイに移動、「場に出す」で盤面へ戻す。手札の**中身はクライアントローカル(localStorage)限定**でネットワークに出さず、他者には**枚数のみ** awareness で共有（「他 N枚」）。
    - `createCardPlugin` に `userId` / `boardId` / `wsProvider`(枚数共有用) / `legacyDoubleClickActions` オプションを追加。
    - これはクライアントローカルの暫定 privacy 実装。中身が漏れない・クロス端末・権威のある真の伏せ手札はサーバー権威方式（#686 で追跡）。

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

- 8c1df08: Debug HUD をプラグイン操作の**汎用コントロール面**に昇格。ホストアプリに専用 UI を足さなくても、プラグイン操作を HUD だけで駆動できる。
  - **Action レジストリ新設**（`@edv4h/usketch-shared` / `@edv4h/usketch-core`）: `PluginContext.actions` / `AppInstance.actions` を追加。プラグインが `ctx.actions.register({ id, label, group?, icon?, params?, run, isActive?, isEnabled? })` で操作を宣言でき、`tools`/`shapes` と同じく `getAll()`/`getOrdered()` で列挙可能・`subscribe` で変更通知。`ActionParam` は `string|number|boolean|color|enum`。
  - **Debug HUD**（`@edv4h/usketch-plugin-debug-hud`）: 新「Controls」パネルを追加。Tool palette（`tools.getOrdered()` → `setActiveToolId`）、Actions（レジストリからボタン/パラメータフォームを自動生成）、任意イベント emit コンソール（未移行操作のフォールバック）、既定スタイル編集 / Clear canvas。DEV 限定を解除し本番でも `` ` `` でトグル可能に。
  - **主要プラグインを Action 登録に移行**: freedraw（ペン種/色/太さ/消しゴム）・snap（On/Off）・bg-grid（背景 grid/dots/none）・card（card-type 選択、選択カードの flip/手札、選択デッキの draw/shuffle）・sticky（色）。挙動は既存イベントを emit するだけで不変。

  残り（wireframe/domain/basic-shape のサブタイプ、connector のプロパティ）は同一パターンで追随予定。既存 Demo UI は撤去せず共存。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [51216e7]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-core@2.1.0
  - @edv4h/usketch-canvas-engine@1.2.1
  - @edv4h/usketch-store@3.3.1

## 1.3.3

### Patch Changes

- Updated dependencies [a7b3e78]
  - @edv4h/usketch-shared@4.4.0
  - @edv4h/usketch-store@3.3.0
  - @edv4h/usketch-core@2.0.5

## 1.3.2

### Patch Changes

- Updated dependencies [05b6e0b]
  - @edv4h/usketch-shared@4.3.0
  - @edv4h/usketch-store@3.2.0
  - @edv4h/usketch-core@2.0.4

## 1.3.1

### Patch Changes

- Updated dependencies [8d341b3]
  - @edv4h/usketch-shared@4.2.0
  - @edv4h/usketch-store@3.1.0
  - @edv4h/usketch-core@2.0.3

## 1.3.0

### Minor Changes

- e1228da: card-type ごとに LOD（低ズーム）簡易表示を渡せるようにした（#631）。
  - `CardTypeDefinition.renderSimplified?(fields)` を追加。指定すると、その card-type のカード / デッキの低ズーム表示に使われる。`renderFront` と同様、plugin がカード枠（world 座標へ self-position）を用意するので、card-type 側は枠内の中身だけを返せばよい。
  - plugin が `card` / `card-deck` の `ShapeDefinition.simplifiedComponent` へ配線:
    - `card`: その shape の `meta.cardType` の `renderSimplified` を使用。
    - `card-deck`: 一番上のカード（`cards[0]`）の fields で `renderSimplified` を呼ぶ。
    - `renderSimplified` 未定義 / 空デッキ / 未知 card-type のときは従来どおりグレー矩形（`shape.style.fill`）にフォールバック。
  - 組込みの EXAMPLE card-type（media / playing-card / uno）に `renderSimplified` を実装し、引きでも種別が判別できるようにした。

  これにより、LOD 簡易表示のために利用側が shape 定義を再 register する回避策が不要になる（#625 / #626 と合わせて、カード関連の shape 定義上書きは解消）。

## 1.2.0

### Minor Changes

- 3e53816: カード / デッキをリサイズ不可（サイズ固定）にできるオプションを追加（#626）。
  - `@edv4h/usketch-plugin-shape-card`:
    - `createCardPlugin({ resizable?: boolean })` — プラグイン全体の既定（既定 `true`）。
    - `CardTypeDefinition.resizable?: boolean` — card-type 単位の指定（プラグイン全体より優先）。「value カードは固定、トランプは可変」のような出し分けが可能。
    - 指定時、`card` / `card-deck` の `ShapeDefinition.resizable` に per-instance で反映される。利用側で `resize` / `applyBounds` を no-op に差し替えるハックが不要になる。
  - `@edv4h/usketch-shared`: `ShapeDefinition.resizable` が `boolean` に加えて述語 `(data) => boolean` を受け付けるようになり、単一 shape type でもインスタンスごとにリサイズ可否を変えられる（後方互換）。判定を一本化する `isShapeResizable(def, shape)` を追加・エクスポート。
  - `@edv4h/usketch-tool-helpers` / `@edv4h/usketch-plugin-tool-select`: リサイズハンドルの当たり判定・カーソル・選択オーバーレイのハンドル表示が `isShapeResizable` 経由で述語形式を尊重するように更新。

### Patch Changes

- Updated dependencies [3e53816]
  - @edv4h/usketch-shared@4.1.0
  - @edv4h/usketch-core@2.0.2
  - @edv4h/usketch-store@3.0.1

## 1.1.0

### Minor Changes

- 2e565d7: 新規プラグイン `@edv4h/usketch-plugin-shape-card` を追加。トランプ・UNO・メディアカード等を表現できる **card-type 拡張ポイント**を持つカードシェイプ。カードは表/裏を持ちダブルクリックで裏返せる（3D フリップ）。配置時アニメーション（カスタマイズ可）とデッキ（山札）機構（ドロー / シャッフル）を備える。リサイズは card-type ごとのアスペクト比固定。データモデルは `ShapeData<TMeta>` の generic（meta）方式。

### Patch Changes

- Updated dependencies [fa92cf8]
- Updated dependencies [ad8e01d]
  - @edv4h/usketch-shared@4.0.0
  - @edv4h/usketch-store@3.0.0
  - @edv4h/usketch-core@2.0.1
