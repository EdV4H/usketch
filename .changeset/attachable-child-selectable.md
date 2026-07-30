---
"@edv4h/usketch-tool-helpers": patch
---

attachable な子 (sticker / kimochi 等) を、貼り付き先が非コンテナでも単独で選択できるようにする。

`findShapeAtPoint` / marquee は、親を持つ shape のクリック/範囲選択時に「親が container.selectableChildren を宣言していなければ最上位祖先を返す」設計だった。attachable な子は overlap で貼り付くだけで grouping ではないため、非コンテナ (付箋・テキスト等) に貼ると親が選択され、子を掴んで剥がせなかった。attachable な子はヒットした子自身を返すよう修正 (frame/island の selectableChildren や group の祖先解決は不変)。
