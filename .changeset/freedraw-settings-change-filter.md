---
"@edv4h/usketch-plugin-shape-freedraw": patch
---

`onSettingsChange()` は `getSettings()` の値（モード・ペン・色・太さ・消しゴムの太さ）が変わったときだけ呼ぶようにした。カスタム色の追加や同じ値での更新では呼ばない。
