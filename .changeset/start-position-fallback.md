---
"@edv4h/usketch-plugin-start-position": minor
---

feat(start-position): スタート位置が未設定のボードを開いた時に全 Shape を画面に収める `fallback: "fit-content"` を追加。初期同期の完了を即座に知らせる `whenReady`、キャンバスサイズを渡す `getViewportSize` も追加。同期待ち中にユーザーや deep-link がカメラを動かしていたら fallback は動かない。フィット計算は start-position shape を除外し、回転を考慮するようになった。
