---
"@edv4h/usketch-plugin-presentation": minor
---

`PresentModeOverlay` / `createPresentationPlugin` に発表オーバーレイの拡張を追加。

- **`onExit`**: 発表を抜ける処理をホストから注入できる（`PresentModeOverlay` の `onExit` prop / `createPresentationPlugin` の `onExit` option）。省略時は従来どおり URL クエリ (`?mode=edit`) を書き換える。これまで終了ボタンは URL 駆動固定で、state 駆動のホストではクリックしても抜けられなかったのを解消。
- **`mask`**: 発表中に現スライド（画角）以外の Canvas を暗幕で隠すマスクを追加。オーバーレイ内のトグルボタンで ON/OFF でき、`mask` prop/option でその初期値を渡せる。viewport のアニメーションにも追従する。
- `SlideNavigator` に `getCurrentBounds()`（現スライドの world 矩形）と `getStore()`（ホスト overlay が viewport 取得/購読に使う）を追加。
