# @edv4h/usketch-plugin-elevation

## 0.2.0

### Minor Changes

- 640f50e: feat(elevation): 2D の層とメッシュの層の重なり順を `groundOrder` / `meshOrder` で変えられるように（既定は今まで通り 45 / 46）。map の拠点の範囲やアイコンなど、ほかの地面の層を標高の上に出したいホスト向け。有限の数でない値は既定に戻す

## 0.1.0

### Minor Changes

- cf85e56: feat(elevation): 標高ブラシ（盛る・削る・ならす・平らにする・段にする）。ドラッグ中は手元で描き、離したときに変わったチャンクだけを 1 回の undo として書く
- 890d909: feat(elevation): Mode 7 の 3D ビューで標高を WebGL のメッシュとして描き、地面が本当に盛り上がるように。mode7 の `projectToGround` は任意の高さ `z` を受け取れるように（後方互換）
- 2af113c: 標高プラグインを追加した。ボードの地面に場所ごとの高さを持たせ、シードから無限の起伏を生成する（起伏そのものは同期せず、各クライアントが同じ値を計算する）。2D では高さの色分け・陰影・等高線で描き、`groundHeightService` を提供するのでキャラは坂を上下する。ブラシの差分はチャンクごとの Shape（約 3 KB）に持つ。map には高さを止める `setHeightEnabled` / `renderConfig.heightEnabled` を足し、標高の場があるボードでは map は色だけの平らな地図になる。Mode 7 の既定の tilt 層に `usketch-elevation:ground` を足した。
