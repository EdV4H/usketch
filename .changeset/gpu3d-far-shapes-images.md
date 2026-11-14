---
"@edv4h/usketch-dom-renderer": patch
"@edv4h/usketch-gpu3d-renderer": patch
---

GPU 3D レンダラー（実験中）で、比べて見つかった 2 つのずれを直しました（3D 標準対応 P6c、#1304）。

- **dom-renderer**: 3D 表示で画面の外まで見えている Shape を、簡略表示（LOD）ではなく普通に描くようにしました。間引く範囲・簡略にする範囲の広げ方を、`bg-grid:set-overscan` イベントに加えて描画コンテキストの `view3dOverscan` からも読みます。GPU 3D レンダラーで遠くの Shape が出なかったのはこのためです（CSS 3D レンダラーの見た目は変わりません）
- **gpu3d-renderer**: Shape の中の画像を絵に入れるようにしました。ページが中身を読める画像（読み込み済みで、同じオリジンか CORS 付き）は `data:` URL にして入れます。読めない画像は今までどおり入りません。`imageDataUrl` を追加
