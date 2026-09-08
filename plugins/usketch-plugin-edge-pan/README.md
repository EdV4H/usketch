# @edv4h/usketch-plugin-edge-pan

Shape をドラッグ中、ポインタを**画角の端**に寄せると、その方向へ**画角が自動でスライド（スクロール）**するプラグイン。tldraw の "edge scrolling" 相当。掴んでいる Shape はカーソル下に留まったまま、世界がその下をスクロールします。

## 仕組み

- ポインタが画角端の「帯（margin）」に入ると、`BoardStore.panBy` で毎フレーム画角をパンします。速度は**帯の奥ほど速く**（境界で 0・端で最大）。
- パンのたびに合成 `canvas:pointermove`（screenPoint は据え置き・worldPoint だけ新しい画角で再計算）を発行するので、**ドラッグ中のツールが掴んでいる Shape をカーソル下へ追従**させます。本プラグイン自身は Shape を書き換えません（＝ select 以外のドラッグ系ツールにも効く／Undo を汚さない）。

## 使い方

```ts
import { createEdgePanPlugin } from "@edv4h/usketch-plugin-edge-pan";

// 既定のまま
createEdgePanPlugin();

// ホスト側で挙動を設定
createEdgePanPlugin({
  edgeSize: 64,      // 反応する端の帯の幅(px)
  maxSpeed: 24,      // 帯の最奥での 1 フレームあたりのパン量(px)
  axes: "both",      // "both" | "horizontal" | "vertical"
  curve: (d) => d * d, // 端に近づくほど急加速（既定は線形）
});
```

## オプション（すべてホストが設定可能）

```ts
interface EdgePanOptions {
  enabled?:  boolean      | (() => boolean);       // 既定 true
  edgeSize?: number       | (() => number);        // 既定 48 (px)
  maxSpeed?: number       | (() => number);        // 既定 16 (px/frame)
  axes?:     EdgePanAxes   | (() => EdgePanAxes);   // 既定 "both"
  curve?:    (depth: number) => number;            // 0..1 → 0..1、既定は線形
}
type EdgePanAxes = "both" | "horizontal" | "vertical";
```

- **すべて getter（`() => value`）でも渡せます** — 設定 UI のスライダー等からライブに反映されます（値は毎フレーム評価）。
- 数値は堅牢化のためクランプ・不正値は既定へフォールバック（`edgeSize >= 1`、`maxSpeed >= 0`）。

## HUD（end-user 向け）

プロジェクト規約どおり独自 UI は持たず、共有 HUD に設定グループ「端で画角スライド」を登録します（有効 / 端の帯(px) / 最大速度 / 対象軸）。**HUD の上書きはホスト options より優先**され、options を土台に end-user がその場で微調整できます。

## 補足

- パンは `BoardStore` の viewport constraint を通るので、`setViewportConstraint`（例: dashboard のスクロール制限）が効いている盤面では、その範囲内でのみスライドします。
- ドラッグ検知は `shape:updated`＋pointer-down、終了は `shapes:move-end` / `canvas:pointerup`。
