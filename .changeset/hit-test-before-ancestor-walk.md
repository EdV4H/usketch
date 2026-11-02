---
"@edv4h/usketch-tool-helpers": patch
---

perf: ホバー判定（`findShapeAtPoint`）と範囲選択（`findShapesInRect`）で、座標の当たり判定を先に行い、親をたどる非表示・ロック判定は当たった図形だけにする。フレーム内の図形が多いボードでポインタ移動ごとの処理時間が約 1/15 になる。判定結果は変わらない。
