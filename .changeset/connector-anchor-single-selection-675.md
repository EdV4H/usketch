---
"@edv4h/usketch-plugin-shape-connector": minor
---

複数 shape 選択時に `AnchorHandleOverlay` が選択中の全 shape にアンカーハンドルを一斉表示して煩雑だった問題を修正し、表示タイミングをオプション化した（#675）。

- `createConnectorPlugin()` の `anchorHandles` オプションを `boolean | AnchorHandleMode` に拡張:
  - `"single"`（**既定**）— 単一選択時のみ選択由来のアンカーを表示（コネクタは通常 1 つの source から引くため）。
  - `"selection"` — 全選択 shape に表示（従来挙動）。
  - `"hover"` — ホバー中の shape のみ。
  - `true` = `"single"` / `false` = レイヤー無効（従来どおり）。
- 個別 shape のホバー時アンカー表示はどのモードでも従来どおり機能する。
- `AnchorHandleMode` 型を公開。
