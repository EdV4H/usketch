---
"@edv4h/usketch-tool-helpers": patch
---

`findHandleAtScreenPoint` が `ShapeDefinition.resizable: false` を尊重するように修正（#625）。これまでは `resizable:false` でも shape の端でリサイズカーソルに変わり、ドラッグでリサイズ操作が走っていた（選択オーバーレイはハンドル描画を消すだけで、当たり判定・カーソル・操作は止まっていなかった）。回転判定 `findRotationHandleAtScreenPoint` と同じく、`def?.resizable === false` のとき `null` を返すガードを追加。これにより `resizable:false` だけでカーソル・リサイズ操作の両方が無効になり、利用側で `resize`/`applyBounds` を no-op にする回避策が不要になる。
