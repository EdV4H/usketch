---
"@edv4h/usketch-plugin-shape-card": minor
---

カード操作メニュー + 手札(hand)機能を追加（#671）。

- **カード操作メニュー**: カード / 山札を選択すると近傍にフローティングメニュー（`ShapeAnchorOverlay`）が出る。カードは「めくる」「手札に入れる」、山札は「1枚ドロー」「シャッフル」。
- **旧ダブルクリック操作は既定で撤去**: グローバルな `canvas:pointerdown` 監視の flip / デッキドローは select 等と競合しやすいため既定で無効化。`legacyDoubleClickActions: true` で後方互換復活。
- **手札(hand)**: 「手札に入れる」で画面下部の固定トレイに移動、「場に出す」で盤面へ戻す。手札の**中身はクライアントローカル(localStorage)限定**でネットワークに出さず、他者には**枚数のみ** awareness で共有（「他 N枚」）。
  - `createCardPlugin` に `userId` / `boardId` / `wsProvider`(枚数共有用) / `legacyDoubleClickActions` オプションを追加。
  - これはクライアントローカルの暫定 privacy 実装。中身が漏れない・クロス端末・権威のある真の伏せ手札はサーバー権威方式（#686 で追跡）。
