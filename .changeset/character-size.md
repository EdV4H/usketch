---
"@edv4h/usketch-plugin-character": minor
---

キャラの大きさを設定できるようにした。`size` オプション / `setSize` で、画面上いつも同じ大きさ (`scale: "screen"`、既定 36px) か、地面と同じ縮尺 (`scale: "world"`、ズームに合わせて変わり、`minPx` … `maxPx` に収める) を選べる。描く大きさはレンダラーに `size` (画面 px) で渡す。HUD のキャラクターの設定にも「大きさの基準」と「大きさ」を足した。見た目だけで、登れる段差やジャンプの高さは変わらない。
