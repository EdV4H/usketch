# 01 · Minimal

uSketch を「起動して 1 つの図形を選択ツールでつかむ」だけの最小構成。
依存パッケージとプラグインの最小セットを確認したいときの出発点。

## 走らせる

リポジトリのルートで一度だけ:

```bash
pnpm install
```

その後このディレクトリで:

```bash
pnpm dev
```

http://localhost:4579 を開くと紫の矩形が表示されます。クリックで選択、ドラッグで移動。

`panToolPlugin` も登録していますが、この example はツール切替の UI を出していないので、初期状態の select tool で操作することになります。ツール切替の例は [`../02-multiple-shapes-tools`](../02-multiple-shapes-tools) で。

## 中身

ファイルは 1 つだけ — [`src/main.tsx`](./src/main.tsx)。やっていることは：

1. `createBoardStore()` でストアを作る
2. `createApp({ store, plugins })` でアプリを起動する
3. プラグインを 4 つ渡す
   - `basicShapePlugin` — rectangle / ellipse / triangle などの基本図形
   - `selectToolPlugin` — 選択・ドラッグ・リサイズ
   - `panToolPlugin` — `store.setActiveToolId("pan")` でアクティブにしたときに drag でパン
   - `createDomRendererPlugin()` — 図形を DOM に描画
4. `store.addShape(...)` で図形を 1 つ追加
5. `store.setActiveToolId("select")` で選択ツールを有効化
6. `<AppProvider app={app}><Canvas /></AppProvider>` をマウント

## ここから先

- 図形を増やす → `store.addShape(...)` をもう一度呼ぶだけ
- ツールを増やす → `viewportNavPlugin` / `gridBgPlugin` などを `plugins` に追加
- もう少し賑やかな構成例は [`../02-multiple-shapes-tools`](../02-multiple-shapes-tools)
