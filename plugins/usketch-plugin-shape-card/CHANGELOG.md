# @edv4h/usketch-plugin-shape-card

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
