---
"@edv4h/usketch-gpu3d-renderer": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-css3d-renderer": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-elevation": minor
---

3D 表示を WebGL2 で描く GPU レンダラーを、実験として追加しました（3D 標準対応 P6g-1、#1304）。既定の描画（CSS 3D）は変わりません。

- **gpu3d-renderer（新規・実験中）**: CSS 3D レンダラーの代わりに追加すると、地面（背景色とグリッド）と GPU で描くプラグインの絵を、深度バッファ付きの 1 枚のキャンバスに描きます。この版では Shape やキャラはまだ描きません
- **shared**: どの 3D レンダラーでも同じ形で取れる `view3dRendererService`（`View3dRendererApi`）と、プラグインが GPU レンダラーのキャンバスに描くための描画フック `view3dGl` / `view3dGlService`（`View3dGlApi`・`View3dGlDrawable`）、深度の揃え方 `VIEW3D_DEPTH_GLSL` / `VIEW3D_DEPTH_RANGE_PX` を追加しました
- **css3d-renderer**: `view3dRendererService` も提供します（`Css3dRendererApi` はその拡張）。もう 3D レンダラーがあるボードでは何もしません
- **mode7**: 3D レンダラーを `view3dRendererService` から取ります（無ければ従来どおり CSS 3D レンダラーを探し、それも無ければ自分で用意）
- **elevation**: GPU レンダラーが描いている間は、地形のメッシュを自分のキャンバスではなく GPU レンダラーのキャンバスに描きます
