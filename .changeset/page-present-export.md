---
"@edv4h/usketch-plugin-presentation": minor
"@edv4h/usketch-plugin-export": minor
---

マルチページ:

- presentation: `pages` オプション（`hasPage` / `goToPage` / `pageLabel`）を追加。発表で最後のスライドの次は次のページの先頭へ、最初のスライドの前は前のページの最後へ移る。発表のバーに今のページ名を出す。ページをまたぐ処理は `stepPresentation` などの純関数として export する。
- export: `pages` オプション（`list` / `loadShapes`）を追加。HUD に「Export PNG / SVG / JSON（全ページ）」が出て、全ページを 1 枚の画像（ページを縦に並べ、ページ名の見出し付き）や、ページごとの JSON に書き出す。`buildPagesSvg` / `exportPagesCanvas` / `exportPagesJson` も export する。
