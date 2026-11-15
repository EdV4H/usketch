---
"@edv4h/usketch-shared": minor
---

3D ビューで何がポインターの下にあるかをコアで求められるようになりました（3D 標準対応 P7、#1304）。

- `shapeView3dFaces` / `flatQuad3d` / `flatShapeView3dHeight`: 3D の Shape の面・壁・影がどこにあるか（どの 3D レンダラーも同じ置き方をします）
- `pickView3d`: 画面の点の下にあるもの（立った Shape の面、地面に置かれた平らな Shape、地面）を、Shape の箱の中の点に戻して返します。`view3dRay` / `rayQuad` / `view3dCamera` / `view3dProjection` / `view3dDragPoint` も公開します
- `view3dPickService`: キャンバスが 3D の当たりを答えるサービス（キャンバスの上の層が使います）
- `isView3dShown(store)`: ボードがいま 3D で見えているか
