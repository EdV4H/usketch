# @edv4h/usketch-connector-anchor

usketch の connector 系プラグインで共通利用される、**anchor / endpoint / position tracking / cascade-delete** のロジックを集約したパッケージ。React 層を含まない純粋ロジック層。

## 主な機能

- `anchor-utils.ts` — `getAnchorPoint` / `findClosestAnchor` / `clampToShapeEdge`
- `path-utils.ts` — straight / curve / elbow パスの幾何計算
- `hit-test.ts` — `findShapeAtPoint` / `hitTestConnector` / `getBoundsConnector`
- `tracking.ts` — `createConnectorTracker` (shape 移動時に connector 端点を再計算する store subscriber)
- `cascade-delete.ts` — `createCascadeDelete` (source / target shape 削除時に connector を削除する store subscriber)
- `types.ts` — `AnchorType` / `PathType` / `ArrowHead` / `ConnectableShapeData`

## 利用パッケージ

- `@edv4h/usketch-plugin-shape-connector` — 標準 connector
- `@edv4h/usketch-plugin-domain-design` — DDD ドメイン設計 connector

## ライセンス

MIT
