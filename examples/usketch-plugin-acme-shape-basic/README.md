# @acme/usketch-plugin-shape-basic

uSketch v2 の shape プラグインをサードパーティとして実装するリファレンス実装。
`@edv4h/usketch-shape-utils` を使い、六角形（hexagon）を 1 種類だけ登録する最小例。

## 構成

```
src/
  index.ts          — エントリポイント
  plugin.tsx        — UsketchPlugin 実装
  shapes/
    hexagon.tsx     — shape の render / createDefault / ヒットテスト用の頂点計算
```

## 使い方（host アプリに組み込む）

```ts
import { createApp } from "@edv4h/usketch-core";
import { basicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import { acmeShapeBasicPlugin } from "@acme/usketch-plugin-shape-basic";

const app = createApp({
  plugins: [basicShapePlugin, acmeShapeBasicPlugin],
});
```

これで `acme-hexagon` タイプの shape が追加される。

## ポイント

- `@edv4h/usketch-shape-utils` の `createResize` / `getBounds` / `pointInPolygon` を再利用
- `@edv4h/usketch-shared` の `withRotation` で回転対応のヒットテストが自動で得られる
- 独自の作成 tool が欲しい場合は、同じ `setup(ctx)` 内で `ctx.tools.register(...)` を追加するだけ
