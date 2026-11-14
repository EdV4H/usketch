---
"@edv4h/usketch-gpu3d-renderer": minor
---

GPU 3D レンダラー（実験中）で、Shape より上の 3D の層（キャラ、選択枠、カーソルなど）が見えるようになりました（3D 標準対応 P6g-3、#1304）。

- それらの層は DOM のまま、CSS 3D レンダラーと同じ傾きでキャンバスの上に重ねます。どの層を重ね、どの層をキャンバスに描くかは `splitView3dLayers` で決めます
- 丘の陰にいるかを `view3dOcclusionService` で答えるので、キャラは陰で薄くなります（ほかの 3D レンダラーが先に答えていればそちらを使います）
- CSS 3D レンダラーの CSS の作り方を使うため、`@edv4h/usketch-css3d-renderer` に依存するようになりました
