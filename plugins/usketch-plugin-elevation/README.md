# @edv4h/usketch-plugin-elevation

ボードの地面に **標高（連続した高さ）** を持たせるプラグイン。map プラグインがマスの地形の種類で段を作るのに対し、こちらは場所ごとの高さの数値で、なだらかな丘・谷・尾根・海岸を表す。

- **無限地形**: 場（`elevation-field`）にシードと生成パラメーターを持たせると、全域の起伏が自動で生成される。各クライアントが手元で同じ地形を計算するので、起伏そのものは同期しない（送るのはシードとパラメーターの数十 byte）。生成は整数のハッシュと四則演算だけで書いてあり、どのブラウザでも同じ値になる。
- **2D 表示**: 高さで色分け（水・砂浜・草地・土・岩・雪）、北西からの光の陰影、等高線。引いて見るほど粗いタイルに切り替わるので、どのズームでも描くタイルの数はほぼ一定。
- **地面の高さサービス**: shared の `groundHeightService` を提供する。キャラクターは坂に沿って上下し、shape-3d の `ground: true` の Shape は丘の上に立つ。
- **ブラシの差分**: `elevation-chunk`（512 × 512 units ごと、32 × 32 点の Int16 を base64、約 3 KB）に「生成の上に足した高さ」を持つ。ブラシのツールは次の段階で入る。

UI は Control HUD（「標高」）だけ。独自のツールバーやパネルはない。

## 使い方

```ts
import { createElevationPlugin, getElevationApi } from "@edv4h/usketch-plugin-elevation";

createApp({
  plugins: [
    // map と一緒に使う場合は map より後に置く（下の「map との関係」）
    createElevationPlugin({
      display: { tint: true, shade: true, contour: 32 }, // 見た目の初期値（任意）
    }),
    createMode7Plugin(),
    createDomRendererPlugin(),
  ],
});

// HUD を使わずに操作する
getElevationApi(app.services)?.enableInfinite({ seed: 7, gen: { relief: 400 }, waterLevel: 60 });
```

## HUD

| 項目 | 内容 |
|---|---|
| 標高の表示 | 高さで色分け / 陰影 / 等高線の間隔（0 で なし）。見た目だけの設定で、同期しない |
| 無限地形を作る・変える | シード・起伏の大きさ・山の大きさ・細かさ・尾根の強さ・水面の高さ（-1 で なし）。1 回の undo で戻せる |
| 無限地形を外す | 生成された起伏を消す（ブラシの差分は残る） |
| ブラシの差分を全部消す | 生成されたままの地形に戻す |
| 標高を削除 | 場とすべての差分を消す |

## データ

```ts
// ボードに 1 個（複数あれば id が一番小さいもの）
{ type: "elevation-field", spacing: 16, chunk: 32, version: 1,
  seed?: number, gen?: { v: 1, relief, scale, roughness, ridges, octaves }, waterLevel?: number }

// 差分のチャンク（id は `elev:<fieldId>:<cx>:<cy>`）
{ type: "elevation-chunk", field, cx, cy, data /* 32×32 Int16（1/4 単位、LE）を base64 */ }
```

- どちらもロック済み・当たり判定なし・何も描かない Shape（map の tilemap と同じ扱い）。選択や範囲選択には入らない。
- 標高 = `clamp(生成の高さ + 差分, 0, 4095.75)`。
- 生成パラメーターは場に保存されるので、既定値やアルゴリズムが変わっても既存のボードの地形は変わらない。アルゴリズムを変えるときは `gen.v` を上げる（テストに固定値がある）。

## map との関係

同じボードで高さを持つのはどちらか一方。

- ボードに `elevation-field` があれば、地面の高さはこのプラグインのもの。map の高さ（3D の崖・段差）は map のサービスの `setHeightEnabled(false)` で止まり、map は色だけの平らな地図になる。場を消せば map の高さに戻る。
- `groundHeightService` は後から提供した方が勝つので、このプラグインは setup の時点の提供者（map）を受け取り、「場があれば自分、無ければ map」の関数を提供する。**map より後に登録すること。**

## Mode 7

2D 表示の層 `usketch-elevation:ground` は Mode 7 の既定の tilt 層（`DEFAULT_TILT_LAYER_IDS`）に入っていて、3D ビューでは陰影つきの地面として傾く。本当に盛り上がったメッシュ（WebGL）は次の段階で入る。3D ビューが地面を画面の外まで見せるとき（`bg-grid:set-overscan`）は、その分も描く（上限 `maxOverscanPx`、既定 1200）。

## 段階

1. データ・無限生成・2D 表示（この版）→ 2. ブラシ（盛る・削る・ならす・平らにする・段にする）→ 3. Mode 7 の WebGL メッシュ → 4. キャラの急斜面（`maxSlope`）。
