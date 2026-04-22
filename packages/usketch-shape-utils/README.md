# @edv4h/usketch-shape-utils

uSketch v2 の shape プラグインを書くときに使う共通ユーティリティ集。
サードパーティが `@acme/usketch-plugin-shape-foo` のような独自 shape プラグインを実装する際、bounds 計算・ヒットテスト・リサイズ・GPU primitive の差し込みをここから取ってくる想定。

React に依存しない純粋な関数群なので、サーバサイドでの shape データ処理にも使える。

## Install

```bash
pnpm add @edv4h/usketch-shape-utils @edv4h/usketch-shared
```

## 公開 API

### `getBounds(data: ShapeData): BoundingBox`

shape の AABB を返す。ほとんどの shape はこれをそのまま `ShapeDefinition.getBounds` に指定すれば OK。

### Hit test

| 関数 | 用途 |
|------|------|
| `aabbHitTest(data, point)` | 矩形 AABB との当たり判定 |
| `ellipseHitTest(data, point)` | 楕円との当たり判定 |
| `lineHitTest(data, point, tolerance?)` | 線分との距離判定（デフォルト tolerance: 4px） |
| `pointInPolygon(point, polygon)` | 任意多角形との当たり判定（三角形・六角形・星形など） |

回転に対応したい場合は、`@edv4h/usketch-shared` の `withRotation(hitTest)` でラップする。

### `createResize(minW, minH): ResizeFn`

8 方向（`se` / `nw` / `ne` / `sw` / `e` / `w` / `n` / `s`）のリサイズハンドルに対応した resize 関数を生成する。最小幅・最小高を渡す。

### GPU primitive

WebGPU レンダラが有効な場合に使われる低レベル primitive を返すヘルパ。

| 関数 | 返す kind |
|------|----------|
| `rectGpuPrimitive(data)` | `rect` |
| `roundedRectGpuPrimitive(data)` | `rect`（cornerRadius 自動計算） |
| `ellipseGpuPrimitive(data)` | `ellipse` |
| `lineGpuPrimitive(data)` | `polyline` |

## 使用例

```tsx
import { DEFAULT_STYLE, type ShapeData, withRotation } from "@edv4h/usketch-shared";
import { createResize, getBounds, pointInPolygon } from "@edv4h/usketch-shape-utils";

function getHexagonPoints(data: ShapeData) {
  const cx = data.x + data.width / 2;
  const cy = data.y + data.height / 2;
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return {
      x: cx + (data.width / 2) * Math.cos(angle),
      y: cy + (data.height / 2) * Math.sin(angle),
    };
  });
}

export const hexagonDefinition = {
  render: (data: ShapeData) => (
    <polygon
      points={getHexagonPoints(data).map((p) => `${p.x},${p.y}`).join(" ")}
      fill={data.style.fill}
    />
  ),
  getBounds,
  hitTest: withRotation((data, point) => pointInPolygon(point, getHexagonPoints(data))),
  resize: createResize(10, 10),
  createDefault: ({ id, x, y }) => ({
    id,
    type: "hexagon",
    x,
    y,
    width: 120,
    height: 104,
    style: { ...DEFAULT_STYLE },
  }),
};
```

プラグインとしての組み込み方は [`apps/docs` の Plugin authoring ガイド](https://github.com/EdV4H/usketch/blob/main/apps/docs/src/content/docs/plugins/authoring.md) を参照。

## License

MIT
