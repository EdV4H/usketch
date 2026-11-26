---
"@edv4h/usketch-plugin-shape-basic": minor
"@edv4h/usketch-plugin-shape-frame": minor
---

クリックだけで図形・枠を置けるオプション `clickToPlace` を足した。`createBasicShapePlugin({ clickToPlace: true })` / `createFramePlugin({ clickToPlace: true })` にすると、ドラッグせずにクリックしたとき、既定サイズの図形（選んでいる種類）・枠をクリック点が中心になるように置いて選ぶ。既定は `false` で、今まで通りドラッグでだけ作る。片方の軸だけの細いドラッグは、オンでも何も作らない。
