---
"@edv4h/usketch-plugin-shape-text": minor
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-shape-utils": minor
---

テキストに Figma 風の自動幅を追加。新規テキストは入力に合わせて横に広がり（折り返しなし）、左右・四隅のハンドルで幅を変えると固定幅（折り返し）に切り替わる。左右ハンドルのダブルクリックで自動幅に戻り内容にフィットする。`ShapeDefinition.onHandleDoubleClick`、編集コントローラの `fitOnInput` / `cancelPendingClick` を追加。 IME 変換中も未確定文字に合わせて幅を広げる（`TEXT_PREVIEW_EVENT`）。

- 複数選択のリサイズでも幅が変われば固定幅に切り替える（text に `applyBounds` を追加）
- 子をレイアウトするコンテナ（グリッド等）の中では、入力時に幅を争わず固定幅に切り替える
- 2px 未満の横ハンドル操作（ダブルクリック時の手ぶれ等）では幅も自動幅も変えない
- 回転したテキストは入力で大きさが変わっても左上の角を保つ
- `fitOnInput` に適用予定の高さ（`next.height`）を渡し、`fitOnInput` が変えたフィールドはすべて編集の Undo 1 手に含める

AI / MCP 経由で作るテキストは固定幅のまま（#1210）。
