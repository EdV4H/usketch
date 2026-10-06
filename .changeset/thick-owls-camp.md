---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-connector-anchor": patch
"@edv4h/usketch-plugin-ai-agent": patch
---

feat(store): `ShapeData.lockScope: "self"` を追加。`"self"` のロックは子孫へ伝播しない (フレームだけロック)。`createSetLockedCommand` に `scope` 引数を追加。
