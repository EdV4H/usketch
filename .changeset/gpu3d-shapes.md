---
"@edv4h/usketch-gpu3d-renderer": minor
---

GPU 3D レンダラー（実験中）がボードの Shape を描くようになりました（3D 標準対応 P6g-2a、#1304）。

- Shape は DOM の絵を画像にして、地面の高さに平らに置きます（CSS 3D レンダラーと同じ位置・重なり順）。画像は Shape が変わったときだけ作り直し、できるまでは薄い四角で描きます。`createGpu3dRendererPlugin({ shapes: false })` で描かないこともできます
- 地面のグリッドを、bg-grid と同じ線（`#e0e0e0`・半透明・平らな画面の 1px）で描くようにしました。地面そのものは塗らず、ボードの背景と空が線の間から見えます（CSS 3D と同じ見え方）
