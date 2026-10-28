---
"@edv4h/usketch-dom-renderer": patch
---

perf(dom-renderer): 画面外の図形（ビューポート LOD）の simplifiedComponent を `React.memo` で包み、パン・ズームや別の図形のドラッグのたびに画面外の全図形を再描画しないようにした
