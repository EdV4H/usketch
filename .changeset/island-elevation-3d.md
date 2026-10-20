---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-shape-island": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-character": minor
---

島に高さ（`islandElevation`）を追加。HUD「島（選択中）」で選択中の島の高さを変えられ、平面では影と厚みで、Mode 7 では崖のある立体ブロックとして描かれ、島の上の図形やキャラも上に乗る。キャラは「登れる段差」より高い崖を越えられない（下りは可）。プラグイン間で地面の高さを共有する `groundHeightService` を shared に追加し、Mode 7 には切り抜きで平らにならない深度レイヤー（`depthLayerIds`）を追加。島の背景レイヤーはグリッド・マップ地形より上（order 41）に移動。
