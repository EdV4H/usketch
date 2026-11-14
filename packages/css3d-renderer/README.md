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
| `ground` | 自分で地面を描く層（標高のメッシュなど）。傾けない。奥行きステージでは、地面に立つものより奥に置く |
| `hidden` | 3D 表示の間は出さない |

3D ビューが自分の層ピッカーを持つとき（Mode 7）は、`setTiltLayers` / `setDepthLayers` で一覧を渡す。`null` で宣言に戻る。

## 奥行きステージ（実験）

既定では、傾けた層は層の順に重なる（後の層が前の層の上に描かれる）。奥行きステージをオンにすると、メインのキャンバスを 1 つの 3D 空間にして、傾けた層の中身を実際の奥行きで重ねる。立てた看板の後ろにいるキャラクターは看板に隠れ、手前にいれば看板の前に出る。

HUD の「3D の描き方（CSS 3D）」→「奥行きで重ねる（実験）」か、`setDepthStage(true)` で切り替える。

- 傾けない層は邪魔にならない位置へ動かす: 最初の傾けた層より前の層（空）と `ground` の層は奥へ、それ以外（霧・HUD）は手前へ。それぞれの中では層の順を保つ
- `ground` の層が何かを描いている間は、その下に重なる層（傾けた層も）をさらに奥へ置く。平らなボードでも隠れていたものなので見た目は変わらない
- キャンバスの背景は一番奥に描き直す。ステージ自身は切り取れない（Chrome では `overflow: clip` で 3D が平らになる）ので、親要素で切り取る
- 標高のメッシュ（canvas）は奥行きで並ばないので、その陰に入ったものは下の「地形の陰」で扱う

## 地形の陰

標高のメッシュは canvas なので、ブラウザは「丘の向こうの看板」を丘の後ろに回せない（丘の上に描いてしまう）。そこで、カメラから見て地面の陰に入ったものを薄くする（既定）か隠す。

- 判定は shared の純関数 `isOccluded(point, view, heightAt)`: 点から目（`cameraEye(view)`、CSS の `perspective()` の視点）までの視線に沿って地面の高さ（`ctx.height` の `groundAt`）を調べ、視線より高い地面があれば陰
- レンダラーはこの答えを `view3dOcclusionService`（shared）で出す。3D の Shape は上端が陰に入ったら、キャラクターは体の中ほどが入ったら薄くなる。キャラクターの体は描き手（ホスト）が `occluded` を見て面ごとに薄くする（3D の入れ物に opacity を付けると平らになるため）
- 箱（`box`）は壁と天面を 1 枚ずつ薄くする。種別の自前の 3D 表現（`render3d`）は薄くすると平らになるので、陰では隠す
- 毎フレームすべてを調べると重いので、答えは 100ms 使い回し、1 フレームで調べ直すのは 40 個まで（`createOcclusionCache`）
- HUD の「地形の陰」（薄くする / 隠す / そのまま）か `setOcclusion(mode)` で切り替える

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
| `depthStage` | 奥行きステージをオンで始める。既定 `false` |
| `hud` | 設定（地形の陰・奥行きステージ）を HUD に出す。既定 `true` |
| `occlusion` | 地形の陰に入ったもの: `"fade"`（既定）/ `"hide"` / `"none"` |

### `css3dRendererService`

`ctx.services` に置かれる `Css3dRendererApi`。

| メソッド | 内容 |
|------|------|
| `isDrawing()` | いま 3D で描いているか（切り替えの進み具合が 0 より大きい） |
| `setTiltLayers(ids \| null)` | 傾ける層を決める |
| `setDepthLayers(ids \| null)` | 奥行きを持たせる層を決める |
| `getTiltLayers()` / `getDepthLayers()` | いまの一覧 |
| `setDepthStage(on)` / `isDepthStage()` | 奥行きステージ（実験）の切り替え |
| `setOcclusion(mode)` / `getOcclusion()` | 地形の陰に入ったものの見せ方 |

### `setupCss3dRenderer(ctx, options?)`

プラグインを使わずに組み込むとき用。`{ api, dispose }` を返す（ボードの 3D 表示の状態が無いときは `null`）。

### 純関数

- `layerTransform(state)`: 傾けた層の `transform` / `transform-origin`
- `cameraHeightPx(state, zoom)`: 画面上のカメラの高さ（px）
- `drawDistanceClip(...)` / `drawDistanceOverscanPx(...)`: 描画距離の切り取りと、背景を奥まで敷く幅
- `tiltLayerRules(ids, options)`: 層を傾ける CSS
- `depthStageRules(options)`: 奥行きステージの CSS
- `projectionCamera(state, zoom)`: 描いているカメラを shared の射影関数の形で
- 3D の Shape の配置: `selectShapes3d` / `shapePose` / `poseBox` / `poseTransform` / `render3dFrame` / `boxWalls` / `shadowStyle` など

## 描画の仕組み

- 1 枚の `<style data-css3d-renderer>` に `!important` の規則を書き、メインのキャンバスに付けた `data-view3d-stage` 属性で範囲を絞る。React の再描画を越えて残り、後から追加された層にも効く
- カメラの高さは CSS 変数 `--usketch-mode7-camera-height` 1 つで全層を下げるので、毎フレーム変わってもシートは書き換えない
- 旧属性 `data-mode7-stage` と旧イベント `bg-grid:set-overscan` も次のメジャーまで出す
