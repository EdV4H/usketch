---
"@edv4h/usketch-plugin-shape-connector": patch
---

選択ツールのアンカーハンドル（図形ホバーで出る接続点からコネクタを引く操作）の接続先判定を、コネクタツール・端点ドラッグと同じ `findShapeAtPoint`（`@edv4h/usketch-connector-anchor`）に統一する。独自実装だった `findNonConnectorShape` を削除し、次のように揃う:

- 重なった図形は挿入順ではなく zIndex 順で最前面のものを接続先にする（前面へ移動した図形が正しく選ばれる）
- 非表示・ロック中の図形（とロックされたコンテナの子）にはアンカーハンドルを出さず、接続先にもしない
- `domain-connector` も接続先から除外する
