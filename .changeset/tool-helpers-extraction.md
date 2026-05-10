---
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-plugin-tool-select": patch
---

Issue #576: tool 用の state machine helper を新パッケージ `@edv4h/usketch-tool-helpers`
に切り出した。

`plugin-tool-select` 内部で 1000 行超に渡って手書きされていた drag / resize /
rotate / marquee / hover の state machine を、再利用可能な session API として
公開する。

新公開 API:

- `startDragSession` — 移動 (子孫の自動追従、snap callback、`commit()` で `createMoveShapesCommand` を返却)
- `startResizeSession` — single + multi の discriminated union。8 方向ハンドル、
  flip 検出、`def.applyBounds()` フック対応
- `startRotateSession` — atan2 ベースの角度計算、shift で 15° snap、子要素の剛体回転
- `startMarqueeSession` — intersect / contain（alt 切替）、最小ドラッグ距離フィルタ
- `trackHover` / `findShapeAtPoint` — handle / shape body の hit-test 純関数
- 既存の `resize-utils.ts` の関数群（`findHandleAtScreenPoint`、
  `getCursorForHandle`、`computeMultiResizeUpdates` 等）を helper パッケージ
  経由で公開

`plugin-tool-select` 側は session 呼び出し形式に書き換え済み。挙動・パブリック
API・undo 履歴は完全互換 (内部リファクタのみ)。

`@edv4h/usketch-shape-utils` と同じく `@edv4h/usketch-shared` + `@edv4h/usketch-store`
にしか依存しないので、weboard などの外部リポジトリからもプラグインを介さず
import できる。

docs ガイド (英語 / 日本語) に「Reusable Session Helpers」セクションを追加し、
ドラッグで矩形を描画する最小カスタムツール例を掲載した。

参照: Issue #576
