---
"@edv4h/usketch-plugin-shape-connector": minor
---

コネクタの内蔵 UI レイヤーをホストから opt-out できるようにした（#665）。`createConnectorPlugin(options?)` に per-layer フラグ `ConnectorPluginOptions` を追加し、shape 定義・作成ツール・位置追従/カスケード削除（コア挙動）は常に有効なまま、UI レイヤーだけを無効化できる。内部 layer id への依存や `layers.unregister` の手動呼び出しが不要になる。

```ts
// 独自の property UI を持つホストは内蔵ツールバーを抑止できる
createConnectorPlugin({ propertyBar: false });
```

- 追加オプション（いずれも既定 `true`）: `propertyBar`（線種/矢じりのパラメータ Toolbar）/ `endpoints`（端点ハンドル）/ `labelEditor`（ラベル編集）/ `anchorHandles`（hover アンカー表示 + anchor-drag 作成）。`anchorHandles: false` でも `connector-draw` ツールでの作成は可能。
- 安定 API として layer id 定数 `CONNECTOR_LAYER_IDS` を公開（命令的に `layers.unregister` したいホスト向け）。
- 既定ではすべて登録され、従来と完全に後方互換。
