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
- **セルに合わせる（fit to grid）**: リサイズ時にアイテムサイズを整数セルへスナップ（離した時に
  スナップ＋スナップ先ハイライト）。セル寸法変更時も即リサイズ。
- **範囲外は自由（freeOutOfRange）トグル**: グリッド列範囲外へドラッグしたアイテムを管理外（自由）
  にする。左端手前へのドロップは解放せず先頭へ差し込む（判定は中心基準）。
- **スクロール制限（viewportLock）**: Zoom 100% 固定。セル幅=数値なら縦横スクロール、「幅Auto」
  ON ならセル幅とアイテム幅を画面幅へ自動フィット（ウィンドウリサイズ追従）して縦のみスクロール。
  Core の `setViewportConstraint` を利用。
- **避ける（avoid-on-drop / absolute）**: 占有セルに重ねると相手が最寄りの空きセルへ退避（ドラッグ
  方向へ押し出し、左/上も可）。重なり率しきい値・発火ディレイ（ドウェル）を設定可。ドラッグ中は
  ライブプレビュー、ドロップで確定（本体はスナップ、離すまで非スナップ）。
- **スライドアニメーション**: 並べ替え/避け/整列の再配置を CSS トランジションで滑らかに（ドラッグ
  本体は除外）。`data-shape-id`（dom-renderer）を利用。
- **既定設定**: 新規ダッシュボードの既定を「配置=そのまま / 幅Auto=ON / セルに合わせる=ON /
  避ける=ON / 範囲外は自由=OFF / スクロール制限=ON」に。
- サービス API（`DashboardApi`）と HUD 設定を上記に合わせて拡張。
