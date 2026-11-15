---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-plugin-elevation": minor
---

CSS 3D 表示で、丘の陰にある Shape を地形で隠すようにしました（#1304）。これまで Shape は DOM なので WebGL の地形より常に手前に描かれ、丘の向こうでも透けて見えていました。elevation が Shape の上に「カバー」の canvas を重ね、地形が Shape より目に近い画素だけ地形を描き直します。斜面に寝ている Shape は足元の地面に食われないようにしています。

- shared: `view3dShapeFacesIn`（3D 表示で各 Shape が描かれている面）と `View3dPickApi.facesInView`
- canvas-engine: Canvas が `facesInView` を提供
- elevation: 表示設定 `coverShapes`（既定オン、HUD「標高の表示」の「3D で丘の陰の Shape を隠す」で切り替え）とプラグインオプション `coverShapes` / `coverOrder`（既定 52）。GPU 3D レンダラーは深度で前後を付けるので使いません
