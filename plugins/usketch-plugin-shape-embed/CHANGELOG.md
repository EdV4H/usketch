# @edv4h/usketch-plugin-shape-embed

## 0.1.25

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
- Updated dependencies [1884f5a]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [572a76b]
- Updated dependencies [3c434bc]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0
  - @edv4h/usketch-sync@1.5.0
  - @edv4h/usketch-store@3.12.0

## 0.1.24

### Patch Changes

- Updated dependencies [b16cfe8]
- Updated dependencies [d81aad4]
- Updated dependencies [eb20881]
- Updated dependencies [fff9073]
  - @edv4h/usketch-shared@4.24.0
  - @edv4h/usketch-sync@1.4.0
  - @edv4h/usketch-store@3.11.6

## 0.1.23

### Patch Changes

- Updated dependencies [55459fd]
  - @edv4h/usketch-shared@4.23.0
  - @edv4h/usketch-store@3.11.5

## 0.1.22

### Patch Changes

- Updated dependencies [9ffa649]
  - @edv4h/usketch-shared@4.22.0
  - @edv4h/usketch-store@3.11.4

## 0.1.21

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-store@3.11.3

## 0.1.20

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-store@3.11.2

## 0.1.19

### Patch Changes

- Updated dependencies [ca67108]
  - @edv4h/usketch-store@3.11.1

## 0.1.18

### Patch Changes

- Updated dependencies [33a4ef2]
- Updated dependencies [157cce0]
  - @edv4h/usketch-store@3.11.0

## 0.1.17

### Patch Changes

- Updated dependencies [2fa13a5]
- Updated dependencies [2fe644e]
- Updated dependencies [6f3ef3b]
- Updated dependencies [9b3a0a1]
  - @edv4h/usketch-shared@4.19.0
  - @edv4h/usketch-store@3.10.0

## 0.1.16

### Patch Changes

- Updated dependencies [1962032]
- Updated dependencies [8cb3482]
  - @edv4h/usketch-shared@4.18.0
  - @edv4h/usketch-store@3.9.2

## 0.1.15

### Patch Changes

- Updated dependencies [dc5d8d1]
  - @edv4h/usketch-shared@4.17.0
  - @edv4h/usketch-store@3.9.1

## 0.1.14

### Patch Changes

- Updated dependencies [bfba838]
  - @edv4h/usketch-shared@4.16.0
  - @edv4h/usketch-store@3.9.0

## 0.1.13

### Patch Changes

- Updated dependencies [38ca865]
- Updated dependencies [b71dd10]
  - @edv4h/usketch-shared@4.15.0
  - @edv4h/usketch-store@3.8.1

## 0.1.12

### Patch Changes

- Updated dependencies [fa69bfb]
- Updated dependencies [f4b7387]
  - @edv4h/usketch-shared@4.14.0
  - @edv4h/usketch-store@3.8.0

## 0.1.11

### Patch Changes

- Updated dependencies [1854e30]
  - @edv4h/usketch-store@3.7.0

## 0.1.10

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0

## 0.1.9

### Patch Changes

- Updated dependencies [102a284]
  - @edv4h/usketch-shared@4.12.0
  - @edv4h/usketch-store@3.5.4

## 0.1.8

### Patch Changes

- Updated dependencies [06f3ef8]
  - @edv4h/usketch-sync@1.3.0

## 0.1.7

### Patch Changes

- Updated dependencies [5e301c0]
  - @edv4h/usketch-shared@4.11.0
  - @edv4h/usketch-store@3.5.3

## 0.1.6

### Patch Changes

- Updated dependencies [6a1e9b9]
  - @edv4h/usketch-sync@1.2.0

## 0.1.5

### Patch Changes

- Updated dependencies [9747462]
  - @edv4h/usketch-shared@4.10.0
  - @edv4h/usketch-store@3.5.2

## 0.1.4

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 0.1.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 0.1.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

## 0.1.0

### Minor Changes

- 56a6d63: 埋め込みプラグイン `usketch-plugin-shape-embed` を追加。外部Webコンテンツを **iframe でキャンバスに埋め込む `embed` シェイプ**（tldraw の embed 機構に着想）。
  - **プロバイダ許可リスト**（YouTube / Vimeo / Figma / Google Maps / CodeSandbox）＋任意 http(s) の汎用フォールバック。既知プロバイダは共有URL→埋め込みURLへ変換し必要最小の iframe `sandbox`/`allow`、未知URLは strict sandbox（`allow-same-origin` 無し）。`createEmbedShapePlugin({ embeds })` で定義を追加/上書き可能。
  - **select-vs-interact**: 通常は選択/移動/リサイズ可（iframe は `pointerEvents:none`）、ダブルクリック or ▶ で操作モード、✕/選択解除で戻る。
  - **URL 貼り付け/ドロップ**で埋め込みを生成（`kind:"url"` 外部コンテンツハンドラ、order 0）。
  - **YouTube 再生同期（watch party）**: 再生/一時停止/シークを全ユーザーで同期。位置は共有 doc の `playback` に保持し、`@edv4h/usketch-sync` の server clock 基準でドリフト補正して追従（YouTube IFrame API を postMessage で制御、SDK 不要）。制御は既定「全員操作可（LWW）」、ヘッダの 🔒 でプレゼンターロック（1人主導）に切替可能。

  コンポーネント差し替え: `createEmbedShapePlugin({ components: { Chrome } })` でシェイプの chrome（ヘッダ/枠）を独自コンポーネントに置換可能（`EmbedChromeProps` を受け取り、機能コアの iframe/player は `children` を描画すれば保持）。`DefaultEmbedChrome`/`EmbedChrome` を export。
