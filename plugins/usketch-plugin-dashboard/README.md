# @edv4h/usketch-plugin-dashboard

適用した Canvas 全体を **sortable なフロー・グリッド**にするプラグイン。トップレベルの
Shape（付箋・画像・カード等、任意の既存 Shape）がグリッドのアイテムになり、セルに
整列してスナップする。1つをドラッグして差し込むと、他のアイテムがライブでリフローする。

専用のウィジェット Shape は追加しない。設定（列数・セルサイズ・間隔・余白・原点）は
**データのみの `dashboard-config` シングルトン Shape**（描画なし・locked・非 hit-test）に
保存され、Yjs 同期と Undo に自然に乗る。並び順は **幾何から導出**（row-major の reading
order）するので、`order[]` を別途持たず、位置が同期されれば順序も同期・リロード安定になる。

## 使い方

```ts
import { createDashboardPlugin } from "@edv4h/usketch-plugin-dashboard";

createApp({
  plugins: [
    // container / free-position の後に登録する（during-drag reflow を最後の writer に）
    createDashboardPlugin({ columns: 4, cellW: 200, cellH: 140, gap: 16, padding: 24 }),
  ],
});
```

`autoCreate: false` を渡すと、config シングルトンの作成（＝ボードのダッシュボード化）を
ホスト側に委ねられる。

## サービス API（`ctx.services` / `app.services`）

```ts
import { getDashboardApi } from "@edv4h/usketch-plugin-dashboard";

const api = getDashboardApi(app.services);
api?.repack();                 // 全アイテムを reading order のセルへ再スナップ（1 command）
api?.setColumns(6);            // 列数変更（Undo 可・再レイアウト）
api?.setCellSize(240, 160);
api?.getGridSpec();            // 現在の GridSpec（非ダッシュボードなら null）
api?.isDashboardBoard();
```

HUD の「ダッシュボード」設定グループと「整列」アクションからも同じ操作を呼べる。

## 純関数

`grid.ts`（`cellTopLeft` / `packGrid` / `packGridWithGap` / `indexFromPoint`）と
`order.ts`（`readingOrder`）は副作用のない純関数として公開しており、runtime とサービスの
両方が同じ経路を通る。
