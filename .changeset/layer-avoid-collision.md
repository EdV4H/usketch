---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
---

レイヤー登録に衝突回避オプション `avoidCollision` を追加

プラグインは他プラグインが使う `order` 値を認知できず衝突しがち（現状 `84`/`85`/`90` などで重複多数）。`avoidCollision: true` を指定すると、`order` を「希望値」として扱い、既に同じ実効orderが埋まっていれば空きスロットまで押し上げて一意な順序を割り当てる（開発サーバーのポート確保方式）。押し上げ幅は `collisionStep` で指定可能（既定は帯内に留まる微小値、`1` で整数ポート方式）。未指定レイヤーの挙動は不変。
