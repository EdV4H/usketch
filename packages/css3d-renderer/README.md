# @edv4h/usketch-css3d-renderer

ボードの 3D 表示（コアの `View3dState`）を CSS の 3D 変形で描くレンダラー。DOM レンダラーと組み合わせて使う。Shape は 2D の DOM のまま描き、それを載せた層だけを傾けて奥へ続く地面にする。3D の見た目を持つ Shape（`ShapeData.view3d`）は、自分の層（`shape-3d`）で地面から立ち上げて描く。

Mode 7 などの 3D ビューは、ボードの 3D 表示の状態（カメラ・切り替えの進み具合・描画距離）を変えるだけで、描くのはこのレンダラー。

## Install

```bash
pnpm add @edv4h/usketch-css3d-renderer @edv4h/usketch-dom-renderer @edv4h/usketch-shared react
```

## 使い方

DOM レンダラーと並べて追加する。

```ts
import { createCss3dRendererPlugin } from "@edv4h/usketch-css3d-renderer";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";

createApp({
	plugins: [
		createDomRendererPlugin(),
		createCss3dRendererPlugin(),
		createMode7Plugin(),
	],
});
```

`createMode7Plugin` は、ボードにレンダラーが無ければ自分で 1 つ用意する。今のバージョンでは追加しなくても動くが、次のメジャーからはホストが追加する。

## どの層をどう描くか

層は `Layer.view3d` で 3D 表示での見え方を宣言する。

| `view3d` | 描き方 |
|------|------|
| `tilt` | カメラの傾きで地面に寝かせ、描画距離より奥を切り取る |
| `depth` | `tilt` と同じく寝かせるが切り取らず、中の要素が地面から立ち上がれるように 3D の文脈を保つ |
| `screen` / 未指定 | 画面に固定したまま（HUD・空など） |
| `hidden` | 3D 表示の間は出さない |

3D ビューが自分の層ピッカーを持つとき（Mode 7）は、`setTiltLayers` / `setDepthLayers` で一覧を渡す。`null` で宣言に戻る。

## 3D の Shape

`view3d`（または種別の既定）を持つ Shape を、`depth` の層 `shape-3d`（order 51）で立ち上げて描く。

| mode | 見え方 |
|---|---|
| `stand` | 下辺の中点を軸に起こして立てる。`facing: "camera"` はカメラの方を向く |
| `box` | 面を `height` だけ持ち上げて天面にし、四辺に壁を下ろす（壁の色は `style.fill` を暗くしたもの） |
| `float` | 面をそのまま `height` だけ持ち上げる。下に影 |

- 種別ごとに使える mode と既定・自前の 3D 表現（`render3d`）は、その種別の `ShapeDefinition.view3d`（ホストの `ctx.shapes.configureView3d` で上書き）から読む。宣言の無い種別は `stand` / `float` だけ
- 3D の見た目を持たない Shape も、起伏のある地形の上では平らなままその高さに乗せる（`groundFlat`、既定オン）
- 画面上で小さすぎるもの（既定 8px 未満）・描かれている地面の外・全体 LOD 中は立てない。数は手前から最大 200 個
- 描いている Shape は shared の `shapeClaims(services)` で宣言し、DOM レンダラーはそれを描かない
- プラグインは `css3dShapeSourceService` で種別の表（`types()`）と上限（`limits()`: `minPx` / `maxCount` / `groundFlat`）を渡せる（shape-3d プラグインが HUD の設定を渡すのに使う）
- 立ち上がる見た目の HUD とキャラクターとの当たり判定は、shape-3d プラグインとコア（`ctx.height`）が受け持つ

## 公開 API

### `createCss3dRendererPlugin(options?)`

レンダラーのプラグイン。すでにボードにレンダラーがあれば何もしない。

| option | 内容 |
|------|------|
| `tiltLayerIds` | 宣言の代わりに傾ける層 |
| `depthLayerIds` | 宣言の代わりに奥行きを持たせる層 |
| `view3d` | 3D 表示の状態の置き場所。既定はボードのストア（`BoardStore.getView3d`）。古いストアのホストは自前のセルを渡す |
| `shapes` | 3D の Shape を描くか。既定 `true` |

### `css3dRendererService`

`ctx.services` に置かれる `Css3dRendererApi`。

| メソッド | 内容 |
|------|------|
| `isDrawing()` | いま 3D で描いているか（切り替えの進み具合が 0 より大きい） |
| `setTiltLayers(ids \| null)` | 傾ける層を決める |
| `setDepthLayers(ids \| null)` | 奥行きを持たせる層を決める |
| `getTiltLayers()` / `getDepthLayers()` | いまの一覧 |

### `setupCss3dRenderer(ctx, options?)`

プラグインを使わずに組み込むとき用。`{ api, dispose }` を返す（ボードの 3D 表示の状態が無いときは `null`）。

### 純関数

- `layerTransform(state)`: 傾けた層の `transform` / `transform-origin`
- `cameraHeightPx(state, zoom)`: 画面上のカメラの高さ（px）
- `drawDistanceClip(...)` / `drawDistanceOverscanPx(...)`: 描画距離の切り取りと、背景を奥まで敷く幅
- `tiltLayerRules(ids, options)`: 層を傾ける CSS
- 3D の Shape の配置: `selectShapes3d` / `shapePose` / `poseBox` / `poseTransform` / `render3dFrame` / `boxWalls` / `shadowStyle` など

## 描画の仕組み

- 1 枚の `<style data-css3d-renderer>` に `!important` の規則を書き、メインのキャンバスに付けた `data-view3d-stage` 属性で範囲を絞る。React の再描画を越えて残り、後から追加された層にも効く
- カメラの高さは CSS 変数 `--usketch-mode7-camera-height` 1 つで全層を下げるので、毎フレーム変わってもシートは書き換えない
- 旧属性 `data-mode7-stage` と旧イベント `bg-grid:set-overscan` も次のメジャーまで出す
