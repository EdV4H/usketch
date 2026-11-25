---
"@edv4h/usketch-plugin-export": patch
---

全体・全ページの書き出しを範囲の書き出しと同じ描き方にそろえる。画面と同じ zIndex 順で重ね、回転を反映し、`renderForExport` を使い、`hidden` のシェイプは描かない（外接矩形にも含めない）。
