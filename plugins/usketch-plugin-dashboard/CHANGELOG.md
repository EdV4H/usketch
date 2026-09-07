# @edv4h/usketch-plugin-dashboard

## 0.2.0

### Minor Changes

- 5ac520e: feat(dashboard): span 配置 / flow・absolute 切替 / グリッド領域オーバーレイ / ドラッグ確定の改善
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

### Patch Changes

- Updated dependencies [85b766e]
  - @edv4h/usketch-shared@4.13.0
  - @edv4h/usketch-store@3.6.0

## 0.1.0

### Minor Changes

- 7f81402: feat(dashboard): Canvas 全体を sortable なグリッドにする新プラグインを追加

  適用したボードをダッシュボード化し、トップレベルの任意の既存 Shape をグリッドの
  アイテムとしてセルにスナップ整列する。1つをドラッグして差し込むと他アイテムが
  ライブでリフローする（sortable）。
  - 設定（列数/セルサイズ/間隔/余白/原点）はデータのみの `dashboard-config`
    シングルトン Shape に保存され、Yjs 同期・Undo に自然に乗る
  - 並び順は幾何から導出（row-major の reading order）。`order[]` を持たず、
    位置が同期されれば順序も同期・リロード安定
  - during-drag reflow はドラッグ中の Shape を触らず、他アイテムのみ rAF スロットルで
    再パック。ドロップ時に 1 つの undoable command で確定
  - 操作は純関数（`grid.ts` / `order.ts`）として公開し、runtime・サービス・HUD が
    同じ経路を通る。ホスト向け API は `dashboardService`（`ctx.services`）で公開
  - HUD に「ダッシュボード化 / 解除 / 整列」アクションと設定グループを登録

  `apps/web` では `autoCreate: false` で登録し、メインボードを勝手にグリッド化せず
  HUD の「ダッシュボード化」で opt-in する。
