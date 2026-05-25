# 02 · Multiple shapes &amp; tools

[`01-minimal`](../01-minimal) の続編。よくある「ホワイトボードらしい」最小機能を一通り入れた構成。

- 図形: rectangle / ellipse / sticky note
- ツール: select / pan（左上のスイッチャーから切替）
- 背景グリッド (`gridBgPlugin`)
- 右下のビューポート操作 UI (`viewportNavPlugin`) — ズーム・fit all

## 走らせる

リポジトリのルートで一度だけ:

```bash
pnpm install
```

その後このディレクトリで:

```bash
pnpm dev
```

http://localhost:4580 を開く。左上の「Select / Pan」で動作モードが切り替わります。

## 01 との差分

[`src/main.tsx`](./src/main.tsx) で増えているのは:

- `plugins` 配列に `gridBgPlugin`、`stickyPlugin`、`viewportNavPlugin` を追加
- `store.addShape(...)` を 3 回呼んで rectangle / ellipse / sticky を 1 つずつ配置
- `<ToolSwitcher />` — `useStoreSubscribe` で `activeToolId` を購読し、ボタンで `store.setActiveToolId(...)` を呼ぶシンプルな UI

`createApp` 自体の呼び方は 01 と変わりません。プラグインを足すだけで機能が増える、というのが uSketch の素直なパターンです。

## ここから先

- カスタム図形を増やしたい → プラグイン作者向け雛形は [`../usketch-plugin-acme-shape-basic`](../usketch-plugin-acme-shape-basic) を参照
- 永続化や共同編集も入れたい → `apps/web` がフル構成の参考実装
