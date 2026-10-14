---
"@edv4h/usketch-plugin-presentation": minor
---

open-slide デッキの中身をボード上で書き換えられるようにする。デッキのページで `OpenSlideText` に囲んだ文字は、デッキをダブルクリックするとその場で編集でき、配色 3 色も差し替えられる。差し替えは Shape の `overrides` に保存され、undo できる。`OpenSlideApi` に `beginEdit` / `endEdit` / `setPalette` / `resetOverrides` などを足し、「デッキの中身を編集」「デッキを元の内容に戻す」アクションを登録する。
