---
"@edv4h/usketch-plugin-shape-image": patch
"@edv4h/usketch-plugin-shape-markdown": patch
"@edv4h/usketch-plugin-shape-embed": patch
---

画像・Markdown（テキスト / 表）・URL 埋め込みを貼り付け / ドロップしたときの置き場所（画面の中央）を、各プラグインの手書きの座標計算ではなく共通の `screenCenterWorld` で求めるようにした。ビューが回転しているとき（Mode 7 のヨー回転、キャラ追従など）に、貼り付けた図形が画面の中央から外れた位置に置かれていたのが直る。回転していないときの置き場所は変わらない。
