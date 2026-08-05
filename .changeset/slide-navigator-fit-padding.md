---
"@edv4h/usketch-plugin-presentation": minor
---

`SlideNavigator` / `createPresentationPlugin` に `fitPadding` オプションを追加。

`gotoIndex` の `store.fitToBounds` に渡す余白 (px) をホストから指定できる (省略時は従来どおり 40)。発表でスライドを画角いっぱい (上下または左右が画角の端に接する) に収めたいときは `fitPadding: 0` を渡す。余白 0 で生じるレターボックスは `mask` で暗転できる。
