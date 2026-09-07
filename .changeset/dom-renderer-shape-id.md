---
"@edv4h/usketch-dom-renderer": patch
---

feat(dom-renderer): シェイプ wrapper に `data-shape-id` を付与

各シェイプの DOM ラッパーに `data-shape-id={shape.id}` を追加し、DOM 上でシェイプ要素を id で特定できるようにした。位置は `left`/`top` で指定しているため、プラグイン（dashboard のスライドアニメーション等）が id セレクタで `left`/`top` のトランジションを当てられる。
