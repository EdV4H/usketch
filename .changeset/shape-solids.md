---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-shape-3d": minor
---

3D の Shape の当たり判定（壁・乗れるブロック）をコアに移しました（3D 標準対応 P4b、#1473）。動きは変わりません。

- **shared**: 当たり判定を `shape-solids.ts` に移しました。`createShapeSolids()` は Shape の `view3d` と型ごとの 3D 設定から固体の高さを答えます（`shapeSolidsService`）。`shapeView3dFoot` / `shapeView3dAnchor` も公開します
- **core**: ボードの Shape の固体を `ctx.height` に登録し、`shapeSolidsService` で提供します。shape-3d プラグインが無くても、`view3d` を持つ Shape にキャラクターがぶつかります
- **shape-3d**: コアの固体を使い、自分の型の設定と「3D のときだけ当たる」設定を渡すだけになりました。古いコアでは今まで通り自分で登録します。`shape-3d-collision` の export は shared からの再 export として次のメジャーまで残します
