# @edv4h/usketch-plugin-shape-embed

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
