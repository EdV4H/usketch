---
"@edv4h/usketch-plugin-shape-connector": minor
---

コネクタの内蔵 UI をホストの裁量に分離した（#665）。

- **パラメータ Toolbar（`ConnectorPropertyBar`）をパッケージから完全に撤去。** shape 定義が特定の設定 UI を規定すべきでないため、`createConnectorPlugin()` は property Toolbar を `layers.register` せず、コンポーネント自体もこのパッケージに含めない（UI はホスト管轄）。代わりにコネクタのデータ型 `ConnectorShapeData` / `ArrowHead` / `PathType` を公開し、ホストが自前 UI を組めるようにした。
- 残りの UI レイヤーは `createConnectorPlugin(options?)` の per-layer フラグ `ConnectorPluginOptions` で出し分け可能に（`endpoints` / `labelEditor` / `anchorHandles`、いずれも既定 `true`）。`anchorHandles: false` でも `connector-draw` ツールでの作成は可能。
- 安定 API として登録レイヤーの id 定数 `CONNECTOR_LAYER_IDS`（endpoints / labelEditor / anchorHandles）を公開。
- shape 定義・作成ツール・位置追従・カスケード削除（コア挙動）は常に有効。

**破壊的変更の注意点**: これまで `createConnectorPlugin()` だけで表示されていた property Toolbar は表示されなくなり、`ConnectorPropertyBar` コンポーネントの export も無くなる。従来の見た目が必要なホストは、公開されたデータ型を使って自前の property bar を実装する（apps/web は `src/plugins/connector-property-bar.tsx` に実装を持ち、`createConnectorPropertyBarPlugin()` で layer 登録する形で対応済み）。
