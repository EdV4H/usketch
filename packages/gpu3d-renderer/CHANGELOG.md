# @edv4h/usketch-gpu3d-renderer

## 0.1.0

### Minor Changes

- 8fd9bfa: GPU 3D レンダラー（実験中）で、Shape より上の 3D の層（キャラ、選択枠、カーソルなど）が見えるようになりました（3D 標準対応 P6g-3、#1304）。
  
  - それらの層は DOM のまま、CSS 3D レンダラーと同じ傾きでキャンバスの上に重ねます。どの層を重ね、どの層をキャンバスに描くかは `splitView3dLayers` で決めます
  - 丘の陰にいるかを `view3dOcclusionService` で答えるので、キャラは陰で薄くなります（ほかの 3D レンダラーが先に答えていればそちらを使います）
  - CSS 3D レンダラーの CSS の作り方を使うため、`@edv4h/usketch-css3d-renderer` に依存するようになりました
- 458decc: 3D 表示を WebGL2 で描く GPU レンダラーを、実験として追加しました（3D 標準対応 P6g-1、#1304）。既定の描画（CSS 3D）は変わりません。
  
  - **gpu3d-renderer（新規・実験中）**: CSS 3D レンダラーの代わりに追加すると、地面（背景色とグリッド）と GPU で描くプラグインの絵を、深度バッファ付きの 1 枚のキャンバスに描きます。この版では Shape やキャラはまだ描きません
  - **shared**: どの 3D レンダラーでも同じ形で取れる `view3dRendererService`（`View3dRendererApi`）と、プラグインが GPU レンダラーのキャンバスに描くための描画フック `view3dGl` / `view3dGlService`（`View3dGlApi`・`View3dGlDrawable`）、深度の揃え方 `VIEW3D_DEPTH_GLSL` / `VIEW3D_DEPTH_RANGE_PX` を追加しました
  - **css3d-renderer**: `view3dRendererService` も提供します（`Css3dRendererApi` はその拡張）。もう 3D レンダラーがあるボードでは何もしません
  - **mode7**: 3D レンダラーを `view3dRendererService` から取ります（無ければ従来どおり CSS 3D レンダラーを探し、それも無ければ自分で用意）
  - **elevation**: GPU レンダラーが描いている間は、地形のメッシュを自分のキャンバスではなく GPU レンダラーのキャンバスに描きます
- 2724cca: GPU 3D レンダラー（実験中）がボードの Shape を描くようになりました（3D 標準対応 P6g-2a、#1304）。
  
  - Shape は DOM の絵を画像にして、地面の高さに平らに置きます（CSS 3D レンダラーと同じ位置・重なり順）。画像は Shape が変わったときだけ作り直し、できるまでは薄い四角で描きます。`createGpu3dRendererPlugin({ shapes: false })` で描かないこともできます
  - 地面のグリッドを、bg-grid と同じ線（`#e0e0e0`・半透明・平らな画面の 1px）で描くようにしました。地面そのものは塗らず、ボードの背景と空が線の間から見えます（CSS 3D と同じ見え方）
- d0635ab: 3D の Shape を GPU 3D レンダラー（実験中）でも立てて描くようになりました（3D 標準対応 P6g-2b、#1304）。CSS 3D の絵は変わりません。
  
  - **shared**: どの Shape をどう 3D で描くかの決め方を、2 つの 3D レンダラーで共通にしました。`selectView3dShapes` / `View3dShapeLimits` / `DEFAULT_VIEW3D_SHAPE_LIMITS` / `sanitizeView3dShapeLimits` / `GROUND_FLAT_VIEW3D` / `view3dShapeSourceService`（キーは css3d-renderer のまま）/ `declaredView3dShapeTypes` / `view3dShapeHeading` / `view3dShapeWallColor` / `lerpAngle` を追加
  - **css3d-renderer**: 上を使うようにしました。`selectShapes3d` / `Css3dShapeLimits` / `DEFAULT_CSS3D_SHAPE_LIMITS` / `GROUND_FLAT_PARAMS` / `css3dShapeSourceService` / `sanitizeCss3dShapeLimits` / `lerpAngle` / `wallColor` は shared の同じものの別名として残ります
  - **gpu3d-renderer**: 立てる・箱・浮かせるの Shape を、CSS 3D レンダラーと同じ位置・向き・高さで描きます。深度を持つので、地形や他の 3D の Shape と前後で隠し合います。影も描きます

### Patch Changes

- 711ee35: GPU 3D レンダラー（実験中）で、比べて見つかった 2 つのずれを直しました（3D 標準対応 P6c、#1304）。
  
  - **dom-renderer**: 3D 表示で画面の外まで見えている Shape を、簡略表示（LOD）ではなく普通に描くようにしました。間引く範囲・簡略にする範囲の広げ方を、`bg-grid:set-overscan` イベントに加えて描画コンテキストの `view3dOverscan` からも読みます。GPU 3D レンダラーで遠くの Shape が出なかったのはこのためです（CSS 3D レンダラーの見た目は変わりません）
  - **gpu3d-renderer**: Shape の中の画像を絵に入れるようにしました。ページが中身を読める画像（読み込み済みで、同じオリジンか CORS 付き）は `data:` URL にして入れます。読めない画像は今までどおり入りません。`imageDataUrl` を追加
- Updated dependencies [4a0ff52]
- Updated dependencies [8ff6829]
- Updated dependencies [1884f5a]
- Updated dependencies [d7ff62d]
- Updated dependencies [2f8aab7]
- Updated dependencies [1db8c0c]
- Updated dependencies [34232b1]
- Updated dependencies [458decc]
- Updated dependencies [b86508c]
- Updated dependencies [77babb1]
- Updated dependencies [4846cdc]
- Updated dependencies [7b1ec3c]
- Updated dependencies [cf04198]
- Updated dependencies [5916c16]
- Updated dependencies [b41ea96]
- Updated dependencies [d0635ab]
  - @edv4h/usketch-shared@4.25.0
  - @edv4h/usketch-css3d-renderer@0.1.0
