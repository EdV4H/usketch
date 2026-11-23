---
"@edv4h/usketch-plugin-tabletop": minor
"@edv4h/usketch-plugin-mode7": minor
---

傾けた 3D の画面でも、プレイヤー視点の枠に合わせられるようにしました。

- tabletop: `applyViewCamera` に `getTilt`（`{ pitch, fov, horizon }`、毎回読む。`null` = 平ら）を足しました。ホストが盤面を奥へ傾けて見せている間（Mode 7 など）、視点を傾いた見え方で枠に収めます（奥の辺を上の余白に、手前の広い辺を画面の内側に）。`fixed` はその位置で止め、`zoom` は拡大した分だけ動けます。`fitViewToScreen` / `isAtView` も `tilt` を、`stayInViewConstraint` / `pinToViewConstraint` も `getTilt` を受け取ります。型 `ViewTilt`（上げたカメラの `heightPx` も渡せます）を出しました。傾きを変えたら `returnToView()` で合わせ直してください。
- mode7: `exitOnShapeDoubleClick`（既定 `true`）を足しました。`false` にすると、Shape をダブルクリックしても平面へ戻らず 3D のままです。
