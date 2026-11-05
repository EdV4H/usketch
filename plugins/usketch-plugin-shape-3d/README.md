# @edv4h/usketch-plugin-shape-3d

Mode 7（`@edv4h/usketch-plugin-mode7`）などの 3D ビュー中に、**3D パラメーターを持つ Shape を地面から立ち上げて描く**プラグイン。パラメーターを持たない Shape は今まで通り地面に貼り付いたまま。2D 表示・書き出し・編集には一切影響しない（3D ビューでないときは何も描かない）。

- 描画は map の崖やキャラクターと同じ **CSS 3D だけ**（`translateZ` / `rotateX(-90deg)` の折り曲げ）。3D ライブラリには依存しない。
- 各 Shape プラグインの既存の `render` をそのまま立てるので、全 Shape 種別で使える。
- Mode 7 にも map にも依存しない。3D ビューの状態は shared の `view3dService`、地面の高さは `groundHeightService` から読み、DOM の Shape 層には `renderer:hide-shapes` で「この Shape は描かない」を伝える。

## 使い方

```ts
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";
import { createShape3dPlugin } from "@edv4h/usketch-plugin-shape-3d";

createApp({
  plugins: [
    // …
    createMode7Plugin({ transition: { durationMs: 900 } }),
    createShape3dPlugin({
      // 種別ごとの設定（任意）。既定は全種別で全 mode 可、embed / openui は対象外
      types: {
        "board-portal": { default: { mode: "stand" } }, // ポータルは常に立てる
      },
    }),
    createDomRendererPlugin(),
  ],
});
```

Mode 7 の既定の tilt / depth レイヤー（`DEFAULT_TILT_LAYER_IDS` / `DEFAULT_DEPTH_LAYER_IDS`）には、このプラグインの層 `shape-3d` が入っている。`tiltLayerIds` / `depthLayerIds` を上書きしている場合は `shape-3d` を両方に足すこと（depth に入っていないと平面に潰れる）。

## パラメーター（`x-shape-3d`）

Shape データの拡張キー `x-shape-3d`（`SHAPE_3D_KEY`）に置く。コアの `ShapeData` の型は変えていない。同期でそのまま全員に配られる。

```ts
{
  mode: "stand",            // 立てる（下辺を軸に起こす）
  facing: "camera",         // "camera" = 常にカメラの方を向く（看板・木）/ "fixed" = 下辺に沿って立つ（塀）
  ground: true,             // 地形（groundHeightService）の高さに乗る
  shadow: true,             // 足元に影を落とす
}
```

足りない項目は既定値で埋まり、不正な値は捨てられる（`normalizeShape3d`）。

## 見え方

- 足元（下辺の中点）を軸に、3D ビューのせり上がり（遷移量 0…1）に合わせて起き上がる。OFF にすると倒れて平面に戻り、平面の描画に切り替わる。
- `facing: "camera"` はカメラの旋回（yaw）を打ち消して常に正面を向く。`"fixed"` は Shape 自身の回転のまま。
- 描画距離の外（地面が描かれていない所）、画面上で小さすぎるもの（既定 8px 未満）、全体 LOD 中は立てない。数は手前から最大 200 個（HUD で変更可）。

## HUD

- **3D（選択中の Shape）**: 3D 表示（なし / 立てる）、向き、地形に乗せる、影。2D で選んで設定し、Mode 7 で見る。
- **3D 表示（全体）**: 3D にする最大数、最小サイズ(px)。

## サービス API

```ts
import { getShape3dApi } from "@edv4h/usketch-plugin-shape-3d";
const api = getShape3dApi(app.services);
api?.set(["shape-1"], { mode: "stand", facing: "fixed" });
api?.clear(["shape-1"]);
api?.registerType("sticky", { modes: [] }); // 実行時に種別の設定を足す（戻り値で取り消し）
```

`Shape3dApi`: `get` / `resolve` / `set` / `clear` / `modesFor` / `registerType` / `getLimits` / `setLimits`。

操作の本体は `BoardStore` を受け取る純関数（`setShape3d` / `clearShape3d` / `getShape3d`）としても export している。

## 既知の制約

- Mode 7 はレイヤーごとに別の 3D 空間で描くので、重なりはレイヤー順になる（崖 ＜ 3D Shape ＜ キャラ）。看板の後ろを歩くキャラも看板より手前に見える。
- ズームアウトで map が崖を描かない表示でも、`ground: true` の Shape は地形の高さに乗るので浮いて見えることがある。
