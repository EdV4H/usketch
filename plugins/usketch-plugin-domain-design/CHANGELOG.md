# @edv4h/usketch-plugin-domain-design

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

- 0c838a8: Add `@edv4h/usketch-plugin-domain-design` — the official plugin for drawing **DDD** diagrams (both strategic and tactical) on a uSketch board.

  Provides 5 shape types under a single `domain-draw` tool (shortcut `d`):
  - **Strategic**: `domain-bounded-context` (with team / Core/Supporting/Generic classification), `domain-context-map-connector` (Customer/Supplier, Conformist, ACL, Shared Kernel, OHS, Partnership, Published Language, Separate Ways).
  - **Tactical**: `domain-aggregate`, `domain-class-box` (Entity / ValueObject / Service / Repository / DomainEvent / Factory with stereotype dropdown, class name, attributes, methods), `domain-tactical-connector` (inheritance / realization / composition / aggregation / association / dependency).

  Inline editing is supported: double-click a `domain-bounded-context` / `domain-aggregate` / `domain-class-box` to edit its name (plus attributes / methods / stereotype for ClassBox). Edits go through the command system and are undoable.

  This is the **first official plugin to fully use `ShapeData<TMeta>`'s `meta` field** for domain-specific data — the pattern recommended in `shape-system.mdx`. Existing plugins (`connector`, `frame`, `text`, ...) currently put intrinsic fields directly on `ShapeData`; migrating them to `meta` is tracked as a follow-up.

  `apps/web` registers the plugin in its default `basePlugins` array, so it's available out of the box.

### Patch Changes

- Updated dependencies [673ff7a]
- Updated dependencies [5766fa8]
- Updated dependencies [899b4b2]
- Updated dependencies [1265b13]
- Updated dependencies [f8fee37]
- Updated dependencies [3238756]
- Updated dependencies [2f4f755]
- Updated dependencies [9b64581]
- Updated dependencies [dcc2c10]
  - @edv4h/usketch-connector-anchor@0.2.0
  - @edv4h/usketch-shared@2.0.0
  - @edv4h/usketch-core@1.1.0
  - @edv4h/usketch-canvas-engine@1.1.0
  - @edv4h/usketch-shape-utils@2.0.0
  - @edv4h/usketch-store@2.0.0
