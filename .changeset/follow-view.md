---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-character": minor
---

追従カメラをコア（shared）に置きました（3D 標準対応 P5、#1478）。動きは変わりません。

- **shared**: `follow-view` を足しました。動くものを画面の決まった位置に置き続け（`fixed` / 向きに合わせて回す `rotate`）、3D 表示中はカメラの高さを足元の地面に合わせます。自分でフレームを回す呼び手向けの `createFollowView({ store, services })`（`step` / `reset` / `releaseHeight` / `onPan` / `viewTurn`）と、目標だけ渡せば自分のループで追う `followView(board, target, options)` があります。計算は純関数（`followRotation` / `easeFollowFocus` / `followCameraHeight` / `followViewport` / `smoothingAlpha` ほか）でも使えます
- **character**: 追従カメラを shared の `createFollowView` で動かすようになりました。`character-camera` の export（`targetRotation` / `easeFocus` / `CameraFocus` など）は次のメジャーまで残します
