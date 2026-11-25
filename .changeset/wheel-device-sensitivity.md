---
"@edv4h/usketch-plugin-viewport-nav": minor
"@edv4h/usketch-canvas-engine": patch
"@edv4h/usketch-shared": minor
---

マウスホイールとトラックパッドで、スクロール速度とズーム速度を別々に設定できるようにした。

- viewport-nav: ホイール操作がマウスかトラックパッドかをイベントごとに推定し（`guessWheelDevice` / `createWheelDeviceDetector`）、デバイス別の感度を使う。新しいオプション `panSensitivity`・`mouse`・`trackpad`・`deviceMode`・`panSensitivityRange`・`hud`・`storage`。既存の `zoomSensitivity` は両デバイス共通の値としてそのまま使える。
- 利用者は HUD の「ビューポートナビゲーション」から 4 つの感度と判定方法（自動 / いつもマウス / いつもトラックパッド）を変えられる。設定は localStorage に保存される。ホスト向けには `getViewportNavApi(app.services)` で同じ設定を読み書きできる。
- canvas-engine: `canvas:wheel` に元の `deltaMode` と `wheelDeltaX` / `wheelDeltaY` を載せるようにした。行/ページ単位の delta（Firefox のマウスホイール）はピクセルに直して渡す。
