---
"@edv4h/usketch-store": patch
"@edv4h/usketch-canvas-engine": patch
---

perf: 図形のドラッグ中に、ボード全体を z 順で並べ直さない。`getShapesSorted()` は zIndex を変えない更新では並びをそのまま使い、更新された図形だけを差し替える。Canvas の描画リストも自前で並べ直さず、ストアの並びを使う。
