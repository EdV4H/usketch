---
"@edv4h/usketch-tool-helpers": patch
---

fix(tool-helpers): `findShapeAtPoint`（`trackHover` の図形ホバー判定も含む）が、図形の前後を Map の追加順ではなく zIndex（`store.getShapesSorted()`）で判定するようにした。「最背面へ」などで並び順を変えた後に、見た目で奥にある図形がクリック・ホバーで選ばれてしまうのを直す。走査時に図形配列をコピーしなくなったため、ホバー 1 回あたりの処理も軽くなる。
