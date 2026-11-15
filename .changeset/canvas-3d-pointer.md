---
"@edv4h/usketch-canvas-engine": minor
---

ボードが 3D で見えている間、ポインターの `worldPoint` が見た目どおりの点（立った Shape の面、平らな Shape、地面）になりました（3D 標準対応 P7、#1304）。ドラッグは押した高さを保つので、掴んだ点がポインターについてきます。平面のときは今までどおりです。`view3dPickService` を提供します。
