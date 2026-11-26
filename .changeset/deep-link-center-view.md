---
"@edv4h/usketch-plugin-deep-link": minor
---

画面の中心で合わせる表示位置のリンク `?cx&cy&zoom` を足した。`captureView(store)` で今の表示（画面の中心の world 座標 + zoom、回転対応）を取り、`encodeDeepLink(search, { view })` で URL に載せる。開いた側は画面サイズや回転が違っても、その world 座標を画面の中心に置く。キャンバスがウィンドウ全体でないホストは `createDeepLinkPlugin({ getViewportSize })` で大きさを渡す。`?x&y&zoom` はそのまま使え、両方あれば `?x&y` を優先する。
