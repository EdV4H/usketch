---
"@edv4h/usketch-plugin-markdown-to-shape": minor
---

mermaid `sequenceDiagram` コンバータ `createMermaidSequenceConverter` を追加（#860）。参加者（participant/actor、`as` エイリアス対応・暗黙宣言は初出順）を上部のボックス＋ライフラインに、メッセージ（`->` `-->` `->>` `-->>` `-)` `-x` など）をライフライン間の水平コネクタ（ラベル付き・矢印は target 向き）に分解する。フローチャートより高い order で登録され sequenceDiagram を優先的に処理。activate/note/loop 等のブロックは現状スキップ（フェーズ1: 参加者＋メッセージ）。返信線の破線はシェイプモデルに dash が無いため実線で描画。
