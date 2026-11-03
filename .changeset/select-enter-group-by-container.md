---
"@edv4h/usketch-plugin-tool-select": patch
---

ダブルクリックでグループ編集に入れる図形を、`"group"` / `"frame"` の type 名決め打ちから ShapeDefinition の `container` 宣言（`isShapeContainer`）で判定するようにした。`voice-frame` などプラグインのコンテナにもダブルクリックで入れるようになる。
