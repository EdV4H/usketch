---
"@edv4h/usketch-plugin-shape-connector": patch
---

複数 shape 選択時に `AnchorHandleOverlay` が選択中の全 shape にアンカーハンドルを一斉表示して煩雑だった問題を修正（#675）。選択が **単一 shape のときのみ**選択由来のアンカーを表示するようにした（コネクタは通常 1 つの source から引くため）。個別 shape をホバーした際のアンカー表示は選択数に関係なく従来どおり機能する。
