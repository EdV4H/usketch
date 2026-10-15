---
"@edv4h/usketch-plugin-export": patch
---

`exportRegion` / `exportCanvas` で HTML シェイプが 2 つ以上あると、Satori が出す clipPath / mask の id が重なり、後のシェイプが先のシェイプの切り抜きを使ってしまう問題を直す（文字が途中で欠ける・一部の要素が消える）。シェイプごとに id とその参照を名前空間で分ける。
