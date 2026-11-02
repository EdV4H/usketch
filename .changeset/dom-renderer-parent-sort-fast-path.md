---
"@edv4h/usketch-dom-renderer": patch
---

perf(dom-renderer): 親子の並べ替えで、親を持つ図形が無いときは入力をそのまま返し、孤児が無いときは ID の Set を作らない（ドラッグ中の毎フレームの処理を短縮）
