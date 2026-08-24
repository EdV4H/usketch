---
"@edv4h/usketch-plugin-scatter": minor
---

「新規Shapeを生成してぶちまける」HUD アクションを追加。

選択した Shape の**コピーを N 個生成して散らす**（関連 Shape が無くても新規生成パスを体験できる）。HUD の「ぶちまけ設定」に **生成数 (`spawnCount`)** を追加し、`scatter:spawn` アクションで実行。種を複製して new-item を組み立てる純関数 `cloneSeedItems(store, seedId, count)` を公開 export に追加。
