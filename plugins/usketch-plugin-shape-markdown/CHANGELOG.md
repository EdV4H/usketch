# @edv4h/usketch-plugin-shape-markdown

## 0.1.4

### Patch Changes

- Updated dependencies [bba174a]
  - @edv4h/usketch-shared@4.9.0
  - @edv4h/usketch-store@3.5.1

## 0.1.3

### Patch Changes

- Updated dependencies [6c6702b]
  - @edv4h/usketch-shared@4.8.0
  - @edv4h/usketch-store@3.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [359d732]
  - @edv4h/usketch-shared@4.7.0
  - @edv4h/usketch-store@3.4.1

## 0.1.1

### Patch Changes

- Updated dependencies [a2cf227]
- Updated dependencies [759e7be]
- Updated dependencies [4764580]
  - @edv4h/usketch-shared@4.6.0
  - @edv4h/usketch-store@3.4.0

## 0.1.0

### Minor Changes

- 92feae7: 新規: Markdown shape プラグイン `usketch-plugin-shape-markdown`（#666）。
  - 新 shape 型 `markdown`（`ShapeData<{ source, isEditing }>` の meta 方式、`renderTarget: "html"`）。
  - 表示は **react-markdown + remark-gfm**（GFM: 見出し / 装飾 / リスト / リンク / 表 / コードブロック / タスクリスト / 引用）。`dangerouslySetInnerHTML` を使わず raw HTML は既定 off なので XSS 安全。
  - **シンタックスハイライト**（rehype-highlight、github 風テーマを内蔵注入、ライト/ダーク追従）。
  - **Mermaid 図**対応（`mermaid`）。mermaid は動的 import で code-split し、`securityLevel: "strict"` で描画。不正構文は生コード＋エラーにフォールバック。
  - 編集は raw Markdown を textarea で直接編集。**編集開始は明示操作**（Control HUD の `Markdown ▸ ✎ Edit source` action。markdown 選択中のみ有効）。blur/Esc/外側クリック/選択解除で確定、undo 対応、空なら削除。表示は内容に応じて高さ自動フィット。
  - **コンテンツ操作は選択中のみ**：未選択時は非操作（クリック/ドラッグで shape 選択/移動）、選択中はリンククリック可＋**Alt+ドラッグでテキスト選択**（プレーンなドラッグは移動のまま）。ダブルクリックで編集に吸われる問題を解消。
  - **ペースト/ドロップ**で markdown shape を自動生成（external-content handler）。表データ（Excel/スプレッドシートの HTML table・TSV/CSV）は **GFM 表**に変換する専用ハンドラ（`order:10`）、それ以外のテキストは catch-all（`order:0`）。=「具体 match が勝ち／無ければ Markdown」という order ベースのルーティング。内部シェイプコピー(`usketch/shapes` JSON)は横取りしない。編集中の textarea へのペーストはネイティブ動作。
  - ツール `markdown-draw`（ショートカット `m`）、LOD 簡易表示、AI serialize、debug fields 対応。

### Patch Changes

- Updated dependencies [8c1df08]
- Updated dependencies [1b75eb1]
- Updated dependencies [c7ff8d9]
  - @edv4h/usketch-shared@4.5.0
  - @edv4h/usketch-store@3.3.1
