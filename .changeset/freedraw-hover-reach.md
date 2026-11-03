---
"@edv4h/usketch-plugin-shape-freedraw": patch
---

perf(freedraw): ホバーの当たり判定で、カーソルから遠いストロークは線分を調べずに外す

`hitStroke` の先頭で、点の範囲を最大半幅 + tolerance だけ広げた箱（shape ごとにキャッシュ、消しゴムと共有）の外にあるカーソルを即 false にする。判定結果は変わらない。
