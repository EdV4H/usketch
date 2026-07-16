---
"@edv4h/usketch-plugin-shape-markdown": minor
---

新規: Markdown shape プラグイン `usketch-plugin-shape-markdown`（#666）。

- 新 shape 型 `markdown`（`ShapeData<{ source, isEditing }>` の meta 方式、`renderTarget: "html"`）。
- 表示は **react-markdown + remark-gfm**（GFM: 見出し / 装飾 / リスト / リンク / 表 / コードブロック / タスクリスト / 引用）。`dangerouslySetInnerHTML` を使わず raw HTML は既定 off なので XSS 安全。
- **シンタックスハイライト**（rehype-highlight、github 風テーマを内蔵注入、ライト/ダーク追従）。
- **Mermaid 図**対応（```mermaid```）。mermaid は動的 import で code-split し、`securityLevel: "strict"` で描画。不正構文は生コード＋エラーにフォールバック。
- 編集は raw Markdown を textarea で直接編集（ダブルクリックで編集、blur/Esc/外側クリック/選択解除で確定、undo 対応、空なら削除）。表示は内容に応じて高さ自動フィット。
- ツール `markdown-draw`（ショートカット `m`）、LOD 簡易表示、AI serialize、debug fields 対応。
