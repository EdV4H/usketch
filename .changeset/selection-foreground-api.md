---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-plugin-tool-select": patch
---

Selection foreground (selection UI) を外部から差し替え可能にする API を追加 (#577)。

- `createApp({ selectionForeground: { render } })` ホスト向けオプション (priority 100 で登録)。
- `ctx.ui.registerSelectionForeground({ id, priority, render })` プラグイン向け registrar。
- 解決ルール: priority 数値大が勝ち、同値なら last-wins。
- `usketch-plugin-tool-select` は priority 0 のデフォルトとして自己登録 (`id: "tool-select-default"`)。挙動・互換性は維持。
- canvas-engine は active エントリを内部 layer `__selection-foreground` として動的にマウント。

詳細は `guides/selection-foreground` (en/ja) を参照。
