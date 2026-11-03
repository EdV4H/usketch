# @edv4h/usketch-plugin-bg-liquid

ボード一面に**粘性の高い液体**が敷き詰められた背景プラグイン。液体はゆっくり流動し、
**指定したオブジェクト（シェイプ）に押しのけられる**。オブジェクトを動かすと前方に液体が盛り上がり、
通った跡には溝が残って、粘度に応じてじわじわと埋まっていく。

## 仕組み

- **ワールド固定の高さ場シミュレーション**（`LiquidField`）。セル `(c, r)` はワールド座標の正方形に対応し、
  パン/ズームしても液面はボードに貼り付いたまま。シミュレーションするのはビューポート周辺の窓だけで、
  窓の外は「静止水位の無限の溜め」とみなす。セルサイズはズームに応じて 2 の冪で切り替わり（画面上で約 7px）、
  切替時は双線形で再サンプリングする。
- 毎フレーム:
  1. **押しのけ** — 押しのけ対象シェイプ（回転矩形 / 楕円）が覆うセルを固体にし、そこに残っていた液体を
     シェイプ中心から外向きに最初の空きセルへ移す（体積保存）。輪郭の周りに縁が盛り上がる。
  2. **粘性流** — 空きセル間の拡散（固体へは流れ込まない）＋静止水位へのゆっくりした復元。
     縁はならされ、シェイプが去った溝はゆっくり埋まる。
- **描画**は 1 セル = 1 ピクセルの bitmap を陰影付け（法線 + 拡散光 + Blinn-Phong のハイライト）し、
  平滑化しながらワールドサイズへ拡大して `<canvas>` に描く。輪郭は符号付き距離場（`edge`）から作る
  メニスカスでセルの階段が出ない。表面のゆらぎ（`flow`）はワールド座標固定のドメインワープ波で、
  シミュレーションとは独立（体積を動かさない）。
- 状態（表示 / 設定）は**ビュー限定（per-viewer・非永続・非同期）**。押しのけ対象のフラグだけは
  `shape.meta.liquidDisplacer` に入るのでシェイプと一緒に同期・保存される。

## 使い方

```ts
import { createLiquidBgPlugin } from "@edv4h/usketch-plugin-bg-liquid";

const app = await createApp({
  store,
  plugins: [
    createGridBgPlugin(),
    createLiquidBgPlugin({
      // visible: true,               // 起動時から液体背景にする（既定 false）
      // settings: { mode: "all", viscosity: 0.8, flow: 0.4, color: "#c98a2b" },
    }),
  ],
});
```

grid / dots と同じ共有イベント `bg:set` で切り替わる（`{ type: "liquid" }` で表示、それ以外で非表示）。

### HUD

- **Liquid** 設定グループ — `表示` / `押しのけるオブジェクト`（指定したシェイプのみ / すべてのシェイプ） /
  `粘度` / `流れ` / `色`。`表示` を OFF にすると直前の背景（grid / dots / none）に戻る。
- **選択シェイプで液体を押しのける（切替）** アクション — 選択中のシェイプの押しのけフラグをまとめて切り替える。

### ホスト API（サービス）

```ts
import { liquidBgService } from "@edv4h/usketch-plugin-bg-liquid";

const liquid = liquidBgService.get(app.services);
liquid?.show();
liquid?.setDisplacer(["shape-1", "shape-2"], true);
liquid?.setSettings({ viscosity: 0.9 });
```

操作ロジックは `BoardStore` を受け取る純関数としても export している
（`setLiquidDisplacer` / `toggleLiquidDisplacer` / `isLiquidDisplacer` / `collectObstacles`）。

## 制約

- エクスポート（`renderExportBackground`）は静止した液面（色 + 光沢）のみ。押しのけの跡は出力されない。
- 押しのけ形状はシェイプのバウンディングボックス（`type === "ellipse"` のみ楕円）。
