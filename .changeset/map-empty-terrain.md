---
"@edv4h/usketch-plugin-map": minor
---

空きマス（未設定タイル）の扱いを設定可能に。`createMapPlugin({ emptyTerrain: "water" })` オプション、または Control HUD の「空きマス」設定で、未ペイント/画面外のマスを指定地形（例: 海）として**描画＋判定**できる。null（既定）は従来どおり透明。`terrainAtCell(cells, col, row, empty?)` ヘルパで「未設定なら fallback 地形」を取得できる。
