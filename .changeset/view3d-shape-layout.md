---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-css3d-renderer": patch
"@edv4h/usketch-gpu3d-renderer": minor
---

3D の Shape を GPU 3D レンダラー（実験中）でも立てて描くようになりました（3D 標準対応 P6g-2b、#1304）。CSS 3D の絵は変わりません。

- **shared**: どの Shape をどう 3D で描くかの決め方を、2 つの 3D レンダラーで共通にしました。`selectView3dShapes` / `View3dShapeLimits` / `DEFAULT_VIEW3D_SHAPE_LIMITS` / `sanitizeView3dShapeLimits` / `GROUND_FLAT_VIEW3D` / `view3dShapeSourceService`（キーは css3d-renderer のまま）/ `declaredView3dShapeTypes` / `view3dShapeHeading` / `view3dShapeWallColor` / `lerpAngle` を追加
- **css3d-renderer**: 上を使うようにしました。`selectShapes3d` / `Css3dShapeLimits` / `DEFAULT_CSS3D_SHAPE_LIMITS` / `GROUND_FLAT_PARAMS` / `css3dShapeSourceService` / `sanitizeCss3dShapeLimits` / `lerpAngle` / `wallColor` は shared の同じものの別名として残ります
- **gpu3d-renderer**: 立てる・箱・浮かせるの Shape を、CSS 3D レンダラーと同じ位置・向き・高さで描きます。深度を持つので、地形や他の 3D の Shape と前後で隠し合います。影も描きます
