---
"@edv4h/usketch-dom-renderer": patch
---

コンテナ扱いの判定を固定の type リスト（`frame` / `island` / `group`）から、shape 定義の `container` 宣言（`isShapeContainer`）に切り替える。これにより `voice-frame` などプラグイン側でコンテナを宣言した shape も、ポインタイベントの透過とドロップ先ハイライト時の zIndex 持ち上げ除外が frame と同じように効く。
