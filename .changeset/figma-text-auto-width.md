---
"@edv4h/usketch-plugin-shape-text": minor
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-shape-utils": minor
---

テキストに Figma 風の自動幅を追加。新規テキストは入力に合わせて横に広がり（折り返しなし）、左右・四隅のハンドルで幅を変えると固定幅（折り返し）に切り替わる。左右ハンドルのダブルクリックで自動幅に戻り内容にフィットする。`ShapeDefinition.onHandleDoubleClick`、編集コントローラの `fitOnInput` / `cancelPendingClick` を追加。
