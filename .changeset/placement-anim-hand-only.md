---
"@edv4h/usketch-plugin-shape-card": patch
---

カードの出現演出（placement アニメ）を「手札から場に出したとき」だけに限定

これまではデッキドロー / 複数ドロー / デッキをバラす / 手動ドロー / 移動でも placement アニメ（deal/slam 等）が再生されていた。演出が意味を持つ「手札プレイ」に絞り、`playCardFromHand` 以外の `emitPlacement` 呼び出し（`shapes:move-end` 購読を含む）を撤去した。
