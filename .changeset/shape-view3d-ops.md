---
"@edv4h/usketch-plugin-shape-3d": minor
---

shape-3d を HUD と操作の純関数だけのプラグインにしました（3D 標準対応 P4d、#1473）。

- 操作の純関数を `setShapeView3d` / `clearShapeView3d` / `getShapeView3d` の名前で export します。`setShapeView3d` の種別は表のほか `(type) => ctx.shapes.getView3d?.(type)` のような引き当てでも渡せます。旧名 `setShape3d` / `clearShape3d` / `getShape3d` は次のメジャーまで残します
- README を、描画は CSS 3D レンダラー・当たり判定はコアという今の分担に合わせて書き直しました
