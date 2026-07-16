# @edv4h/usketch-plugin-shape-markdown

Markdown を整形表示する uSketch の shape プラグイン。付箋 / テキストと同じ HTML 描画 shape として、GFM 記法・シンタックスハイライト・Mermaid 図をキャンバス上でレンダリングする。

## 特徴

- **shape 型** `markdown`（`ShapeData<{ source: string; isEditing: boolean }>` の `meta` 方式、`renderTarget: "html"`）。
- **GFM レンダリング**: 見出し / 太字・斜体 / リスト / リンク / 表 / コードブロック / タスクリスト（チェックボックス）/ 引用。`react-markdown + remark-gfm`。
- **XSS 安全**: `dangerouslySetInnerHTML` を使わず、raw HTML は既定で無効。悪意ある `<script>` 等はレンダリングされない。
- **シンタックスハイライト**: `rehype-highlight`（github 風テーマを内蔵注入、ライト/ダーク追従）。
- **Mermaid**: ` ```mermaid ` ブロックを図として描画。`mermaid` は**動的 import で code-split**（図を含むボードを開いたときだけロード）。`securityLevel: "strict"` で描画し、不正構文は生コード＋エラー文言にフォールバック。
- **編集（明示操作）**: shape を選択し、Control HUD の `Markdown ▸ ✎ Edit source`（バッククォート `` ` `` で HUD を開く）で raw Markdown 編集モードに入る。blur / Esc / 外側クリック / 選択解除で確定。undo 対応。空にすると shape は削除。ダブルクリックには**バインドしない**（コンテンツ操作を邪魔しないため）。
- **コンテンツ操作（選択中のみ）**: shape 選択中はリンククリック可＋**テキスト選択は Alt+ドラッグ**（プレーンなドラッグは shape の移動、Alt を押しながらドラッグでテキスト選択）。**未選択時はコンテンツ非操作**（リンクも押せない）で、クリック/ドラッグは shape の選択/移動になる。
- **ペースト / ドロップ**: キャンバスにペースト（Cmd/Ctrl+V）またはドロップで markdown shape を自動生成（external-content handler）。
  - **表データ**（Excel / Google スプレッドシートの HTML table、TSV/CSV）→ **GFM 表**に変換（`order:10`）。
  - それ以外のテキスト → そのまま Markdown（catch-all `order:0`、host が上書き可）。
  - ＝「具体 match が勝ち／無ければ Markdown」という order ベースのルーティング（専用ルータープラグイン不要。canvas-engine の `externalContent` レジストリがルーターを担う）。
  - 内部シェイプコピー（`usketch/shapes` JSON）は横取りしない。編集中の textarea へのペーストはブラウザ標準動作。
- **高さ自動フィット**: 表示は描画内容に追従（Mermaid の非同期描画にも `ResizeObserver` で追従）。
- ツール `markdown-draw`（ショートカット `m`）、LOD 簡易表示、AI serialize、Debug HUD の debug fields 対応。

## 非対応（今後）

- KaTeX 数式。
- ボード全体の Markdown インポート / エクスポート。

## 使い方

```ts
import { createApp } from "@edv4h/usketch-core";
import { createMarkdownPlugin } from "@edv4h/usketch-plugin-shape-markdown";

const app = await createApp({
  store,
  plugins: [createMarkdownPlugin()],
});
```

ツールバー / ショートカット `m` で配置（配置直後は編集モード）→ 確定後に再編集するときは shape を選択し、Control HUD（`` ` `` で開く）の `Markdown ▸ ✎ Edit source` を実行 → フォーカスを外す / Esc で整形表示に切り替わる。
