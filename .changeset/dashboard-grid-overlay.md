---
"@edv4h/usketch-plugin-dashboard": minor
---

feat(dashboard): span 配置 / flow・absolute 切替 / グリッド領域オーバーレイ / ドラッグ確定の改善

- **アイテムをセルまたぎ（span）で配置**: 各アイテムが自身の width/height に応じて整数セル分を
  占有（大きいものは複数セル）。`packSpans` / `spanOf` / `cellXY` / `targetIndexFromPoint` を追加。
- **配置モードの切替（flow / absolute）**: `flow` は詰めて並べ替え（sortable）、`absolute` は
  落としたセルにそのまま置き隙間を保持。`packAbsolute` / `cellOfPoint` を追加し、config の `mode`
  で切替（HUD「配置」プルダウン / `DashboardApi.getMode`・`setMode`）。
- **グリッド領域オーバーレイ**＋**ドロップ先セルのハイライト**: 配置先が空きスペースでも一目で
  分かる。HUD「グリッド表示」でトグル、非ダッシュボードでは自動非表示。
- **enable 時に原点＋セルを既存アイテムからシード**: 原点をアイテム左上、セルを最小アイテムに
  合わせる（従来はセルが大きすぎて span も整列も見えないことがあった）。
- **ドラッグ確定を event 駆動に修正**: `canvas:pointerdown/up` に依存せず `shape:updated` /
  `shapes:move-end`＋セトル方式で駆動（シェイプ drag では pointer イベントが届かず、確定が
  選択解除まで遅延していた問題を解消）。自分の書き込みは専用ガードで除外。
