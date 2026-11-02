---
"@edv4h/usketch-plugin-shape-freedraw": patch
---

perf(freedraw): 消しゴムのドラッグ中、カーソルから遠いストロークは点を 1 つずつ調べずに範囲（点の bbox を最大半幅で広げたもの）だけで除外するようにした。範囲は shape ごとにキャッシュする。これまでは pointermove のたびに全ストロークの全点を調べていた。判定結果は変わらない
