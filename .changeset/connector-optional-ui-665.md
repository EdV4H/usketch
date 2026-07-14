---
"@edv4h/usketch-plugin-shape-connector": minor
---

コネクタの内蔵 UI をホストの裁量に分離した（#665）。

- **パラメータ Toolbar（`ConnectorPropertyBar`）をプラグインの構成要素から完全に削除。** shape 定義が特定の設定 UI を規定すべきでないため、`createConnectorPlugin()` はもう property Toolbar を `layers.register` しない。代わりに `ConnectorPropertyBar` コンポーネントを export したので、必要なホストは自前の layer として描画する（`useApp()` で store を読む props 不要の自己完結コンポーネント）。
- 残りの UI レイヤーは `createConnectorPlugin(options?)` の per-layer フラグ `ConnectorPluginOptions` で出し分け可能に（`endpoints` / `labelEditor` / `anchorHandles`、いずれも既定 `true`）。`anchorHandles: false` でも `connector-draw` ツールでの作成は可能。
- 安定 API として登録レイヤーの id 定数 `CONNECTOR_LAYER_IDS`（endpoints / labelEditor / anchorHandles）を公開。
- shape 定義・作成ツール・位置追従・カスケード削除（コア挙動）は常に有効。

**破壊的変更に近い注意点**: これまで `createConnectorPlugin()` だけで表示されていた property Toolbar は表示されなくなる。従来の見た目を保つには、`ConnectorPropertyBar` を自前 layer として登録すること（apps/web は `createConnectorPropertyBarPlugin()` で対応済み）。
