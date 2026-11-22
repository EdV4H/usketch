---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-plugin-container": minor
"@edv4h/usketch-plugin-tool-select": minor
---

`container.autoAttach` のコンテナに、付ける条件を 2 つ足した。

- `container.attachHit: "center"` — 図形の「中心」がコンテナに入れば子にする（中心が出たら外す）。既定の `"contain"`（図形全体が入ったときだけ）は変わらない。カードの置き場や席のように、中身とほぼ同じ大きさのコンテナでも、だいたいの位置に落とせば付く。
- `container.accepts(child, container)` — 子にする図形を絞る。`false` を返した図形はそのコンテナを素通りし、外側のコンテナ（フレームなど）に付く。

判定は `getContainerAttachHit` / `containerAccepts`（shared）で読む。store の `createContainmentAttacher` / `findAttachParent` は `attachHit` / `accepts` を受け取れるようになり（`isInsideForAttach` も export）、container プラグインがシェイプ定義から渡す。select ツールのドロップ先のハイライトと、Option+ドラッグの複製の親も同じ規則に従う。
