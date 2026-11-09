---
"@edv4h/usketch-plugin-elevation": minor
"@edv4h/usketch-plugin-map": minor
"@edv4h/usketch-plugin-mode7": patch
---

標高プラグインを追加した。ボードの地面に場所ごとの高さを持たせ、シードから無限の起伏を生成する（起伏そのものは同期せず、各クライアントが同じ値を計算する）。2D では高さの色分け・陰影・等高線で描き、`groundHeightService` を提供するのでキャラは坂を上下する。ブラシの差分はチャンクごとの Shape（約 3 KB）に持つ。map には高さを止める `setHeightEnabled` / `renderConfig.heightEnabled` を足し、標高の場があるボードでは map は色だけの平らな地図になる。Mode 7 の既定の tilt 層に `usketch-elevation:ground` を足した。
