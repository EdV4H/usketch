---
"@edv4h/usketch-plugin-presentation": minor
---

`SlideNavigator` / `createPresentationPlugin` に `isSlide` 述語を注入できるように。省略時は従来どおり Frame シェイプをスライドとして扱うが、`(shape) => boolean` を渡すことで「スライド指定した Frame だけ」や専用の画角 shape をスライドとして扱えるようになった（`SlideNavigatorOptions` / `IsSlide` 型を export）。あわせて `createPresentationPlugin` に `renderEditUI?: boolean`（既定 true）を追加し、`false` にすると edit モードのスライド一覧オーバーレイを抑止して present モードのオーバーレイとショートカットだけをホストから流用できる。ホストが独自 present UI を組めるよう `PresentModeOverlay` も export。
