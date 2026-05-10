# @edv4h/usketch-tool-helpers

uSketch v2 のツールプラグインで再利用可能な state machine helper 集。

`@edv4h/usketch-plugin-tool-select` で baked されていた drag / resize / rotate / marquee / hover のロジックを単独で取り出して公開しており、サードパーティが「ドラッグで描画」「ハンドルでリサイズ」「マーキーで矩形選択」といったツールを書くときに、コアと同じ挙動 (snap・undo・子要素追従・handle flip 等) を 30 行程度で揃えられる。

`@edv4h/usketch-shared` と `@edv4h/usketch-store` にしか依存しないので、React なしのサーバサイド計算でも使える。

## Install

```bash
pnpm add @edv4h/usketch-tool-helpers @edv4h/usketch-shared @edv4h/usketch-store
```

## 公開 API

### Session helpers

各 helper は `pointerdown` で生成、`pointermove` で `update(event)`、`pointerup` で `commit()` するセッションを返す。`commit()` は undo 用 `Command` を返すので、呼び出し側で `ctx.commands.execute(...)` する。

| 関数 | 用途 |
|------|------|
| `startDragSession(opts)` | 選択した shape (子孫含む) を pointer delta だけ平行移動 |
| `startResizeSession(opts)` | single / multi 両対応のリサイズ。8 方向ハンドル、flip 検出、aspect 維持 |
| `startRotateSession(opts)` | 中心点回りで回転、shift で 15° snap、子要素の剛体回転 |
| `startMarqueeSession(opts)` | intersect / contain (alt) の矩形選択 |

### Pure helpers

| 関数 | 用途 |
|------|------|
| `trackHover(ctx, event)` | hover 中の cursor / shape ID / handle hit を返す |
| `findShapeAtPoint(ctx, point)` | shape vs container の選択優先度を考慮した hit test |
| `findShapesInRect(ctx, rect, mode)` | marquee 風の矩形 hit test |
| `findHandleAtScreenPoint(...)` | screen 座標での 8 方向ハンドル hit test |
| `findRotationHandleAtScreenPoint(...)` | corner 外側の回転ハンドル hit test |
| `getCursorForHandle(handle)` / `getRotatedCursorForHandle(handle, deg)` | カーソル文字列生成 |
| `computeRawBounds`, `applyFlip`, `getAnchorEdges`, `fixAnchorDrift`, `computeRelativeProps`, `computeMultiResizeUpdates` | リサイズ計算の構成要素 |

## ドキュメント

英: [Building a Tool Plugin](https://usketch.dev/docs/guides/tool-plugin)
日: [ツールプラグインの作り方](https://usketch.dev/docs-ja/guides/tool-plugin)
