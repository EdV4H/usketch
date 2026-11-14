---
"@edv4h/usketch-css3d-renderer": minor
"@edv4h/usketch-plugin-mode7": minor
---

3D 表示を描く CSS 3D レンダラーを新しいパッケージに切り出しました（3D 標準対応 P2b、#1466）。絵は変わりません。

- **css3d-renderer（新規）**: ボードの 3D 表示の状態を読み、`view3d` を宣言した層を CSS の 3D 変形で傾けます。`createCss3dRendererPlugin()` を DOM レンダラーの隣に追加します。傾ける層・奥行きを持たせる層は `css3dRendererService` で変えられます
- **mode7**: 層を傾ける CSS を自分で書かず、レンダラーに傾ける層を伝えるだけになりました。ボードにレンダラーが無ければ自分で 1 つ用意するので、ホストの変更は要りません。`mode7-transform` の `tiltLayerRules` / `drawDistanceClip` / `drawDistanceOverscanPx` と `CAMERA_HEIGHT_VAR` は、レンダラーからの再 export として次のメジャーまで残します
