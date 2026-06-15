---
"@edv4h/usketch-tool-helpers": minor
---

`startDragSession` / `collectSelectionWithDescendants` に `followChildrenOf` オプションを追加（#612）。

これまで移動時に子を追従させるのはコンテナ（group/frame/island）のみだったが、`followChildrenOf?: (shape: ShapeData) => boolean`（既定はコンテナ判定）で、任意の非コンテナ親（例: 任意のシェイプに `parentId` で取り付けたステッカー/リアクション）の子も追従対象にできる。`includeDescendants` が `true`（既定）のときに参照される。
