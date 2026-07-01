# @edv4h/usketch-plugin-free-position

指定した位置から**最も近い、既存 shape と被らない位置**を求める機能を提供するプラグイン（Issue #581）。
貼り付け/複製/ドロップ/AI 生成などで新規 shape を重ねずに配置したいときに使う。UI は持たない。

## 使い方

```ts
import { createFreePositionPlugin } from "@edv4h/usketch-plugin-free-position";

const plugins = [
  // ...
  createFreePositionPlugin({ strategy: "ring" }), // "ring"（既定）| "push"
];
```

登録すると、`free-position:find` イベントで問い合わせできる（snap の `snap:get-settings` と同じ
同期コールバック方式）:

```ts
import type { BoundingBox } from "@edv4h/usketch-shared";

let result: BoundingBox | undefined;
ctx.events.emit("free-position:find", {
  desired: { x, y, width, height },   // 置きたい位置・サイズ
  excludeIds: ["shape-1"],            // 任意: 衝突判定から除外（移動対象自身など）
  strategy: "push",                   // 任意: このリクエストだけ戦略を上書き
  onResult: (free) => { result = free; },
});
// result が「最も近い空き位置」（同サイズ）。プラグイン未登録なら onResult は呼ばれない。
```

## 探索戦略

- **ring**（既定）: desired 中心から同心リングを外へ広げ、衝突しない最近傍を返す。
- **push**: desired を起点に、重なる相手から最小重なり軸方向へ押し出して分離する。

回転した shape は `getRotatedAABB` で外接矩形にして衝突判定する。

## 連携

`@edv4h/usketch-plugin-keyboard-shortcuts` の paste/duplicate はこのイベントを使い、複数 shape を
相対配置を保ったままグループ単位で空き位置へずらす（本プラグイン未登録時は従来の +20 オフセット）。
drop など他の配置経路も同じイベントを呼べば利用できる。

純ロジックは `@edv4h/usketch-shape-utils` の `findFreePosition` / `overlapsAny` として単体でも使える。
