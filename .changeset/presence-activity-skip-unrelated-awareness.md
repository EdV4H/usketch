---
"@edv4h/usketch-plugin-presence-activity": patch
---

参加者アクティビティのオーバーレイが、カーソル移動など `activity` / `user` 以外の awareness 変化（自分のカーソル移動も含む）のたびに描き直していたのをやめた。リモート参加者の `activity`・名前・色が変わったときと、参加者が抜けたときだけ描き直す。
