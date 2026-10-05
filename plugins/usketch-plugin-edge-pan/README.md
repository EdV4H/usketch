# @edv4h/usketch-plugin-edge-pan

Shape をドラッグ中、ポインタを**画角の端**に寄せると、その方向へ**画角が自動でスライド（スクロール）**するプラグイン。tldraw の "edge scrolling" 相当。掴んでいる Shape はカーソル下に留まったまま、世界がその下をスクロールします。

## 仕組み

- ポインタが画角端の「帯（margin）」に入ると、`BoardStore.panBy` で毎フレーム画角をパンします。速度は**帯の奥ほど速く**（境界で 0・端で最大）。
- パンで画角が動くと、カーソルが止まっていてもドラッグ中のツールは位置を再計算しません（掴んだ Shape がワールドに取り残される）。そこで本プラグインは、パンした分だけ**ドラッグ中の Shape をワールド空間で直接移動**させ、画面上はカーソル下に留めます（移動量 = 実パン量 ÷ zoom）。
- ドラッグ中に動いた Shape の id（select ツールが動かした親＋子孫）を蓄積し、それらを追従対象にします。移動は transient（コマンド化しない）ので Undo を汚さず、drop 時に select ツールが最終位置を 1 コマンドとして確定します（`commit()` は現在の store 位置を採るため追従分も含まれる）。

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

## Snap プラグインとの併用

`@edv4h/usketch-plugin-snap` は `store.updateShape` をモンキーパッチして、ドラッグ中の位置更新をガイドへスナップします。自動パンの追従移動は「画角補正」であってユーザー操作ではないため、追従はスナップさせずカーソル下へ留めたい（スナップさせると、ワールド固定のガイドに貼り付いてスクロールしても図形が動かなくなる）。

edge-pan は setup 時に掴んだ**パッチ前の生 `updateShape`** で追従を行うことでこれを回避します。そのため **edge-pan を snap より先に登録**してください（先に登録されていれば生の updateShape を掴めます）。スクロール中は追従（非スナップ）、ポインタを実際に動かせば snap は通常どおり再作動します。

## 補足

- パンは `BoardStore` の viewport constraint を通るので、`setViewportConstraint`（例: dashboard のスクロール制限）が効いている盤面では、その範囲内でのみスライドします。
- ドラッグ検知は `shape:updated`＋pointer-down、終了は `shapes:move-end` / `canvas:pointerup`。
