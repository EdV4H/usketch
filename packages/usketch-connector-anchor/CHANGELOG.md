# @edv4h/usketch-connector-anchor

## 0.2.1

### Patch Changes

- Updated dependencies [ee6fc3e]
  - @edv4h/usketch-shared@3.0.0

## 0.2.0

### Minor Changes

- 673ff7a: 新パッケージ `@edv4h/usketch-connector-anchor` を追加。anchor 計算 / endpoint hit-test /
  position tracking / cascade delete のロジックを `usketch-plugin-shape-connector` から
  抽出し、他の connector plugin が再利用できる純粋ロジック層として独立。

  `usketch-plugin-domain-design` は新パッケージを使って独自の `domain-connector`
  shape type を実装。BoundedContext / Aggregate / ClassBox 同士を結ぶときに
  **anchor 吸着 / shape 移動追従 / cascade delete** が標準 connector と同等に
  動作する。relation 種別 (context-map / tactical) と multiplicity / upstream /
  label は新規の DDD connector property bar で編集可能。

  なお endpoint ハンドルでの再接続は本リリースではまだ実装されていない（標準 connector
  の `EndpointOverlay` を `domain-connector` まで広げる作業は follow-up）。endpoint を
  変えたい場合は connector を作り直すか、source/target shape を編集する。

  破壊的変更:
  - 旧 `domain-context-map-connector` / `domain-tactical-connector` shape type を廃止
  - 既存ボードの旧 connector データは migration なし（クリーンスタート）

  `usketch-plugin-shape-connector` の外部 API は変わらない（内部リファクタのみ patch）。

### Patch Changes

- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-shared@2.0.0
