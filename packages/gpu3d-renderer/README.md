# @edv4h/usketch-gpu3d-renderer

ボードの 3D 表示（コアの `View3dState`）を WebGL2 の 1 枚のキャンバスで描くレンダラー（**実験中**）。CSS 3D レンダラーの代わりに使う。地面・地形・その上に立つものを深度バッファ付きの 1 枚に描くので、前後の重なりが正しくなる。

キャンバスに描くのは、**地面（グリッド）・GPU で描くプラグイン（標高の地形）・ボードの Shape（平らなものと 3D のもの）**。CSS 3D レンダラーと見比べるためのもので、既定には使わない。

### 層の分け方

描いている間、3D で見せる層（`view3d` が `tilt` / `depth` / `ground` の層）を次のように分ける（`splitView3dLayers`）。

- **Shape の層（`dom-shapes` など）とそれより下の層**: 隠して、中身をキャンバスに描く。地図のタイルなど、まだキャンバスに描けないものもこの間は見えない
- **Shape の層より上の層**（キャラ、選択枠、レーザー、ほかの人のカーソルなど）: DOM のまま、CSS 3D レンダラーと同じ傾きでキャンバスの上に重ねる。見た目は CSS 3D レンダラーと同じ
- 重ねた層はキャンバスの深度とは前後しないので、丘の陰にいるかどうかは、このレンダラーが `view3dOcclusionService` で答える（キャラは陰で薄くなる。ほかの 3D レンダラーが先に答えていればそちらを使う）

### Shape の描き方

Shape は、DOM レンダラーが（隠れたまま）描いた Shape の DOM を画像にして、地面に貼る。画像は Shape が変わったときと、ズームで解像度が足りなくなったときにだけ作り直す。1 フレームで作る量には上限があり、カメラに近いものから作る。できるまでは薄い四角で代わりに描く。

- 置く高さは、CSS 3D レンダラーと同じく Shape の中心の地面の高さ。地形の上に重ねて描く（丘の陰でも隠れない）
- 2D の GPU レンダラーが描く Shape（DOM が無いもの）は、`gpuPrimitive` から描く
- 画像にするときの制限（SVG の `foreignObject` を画像として読むため）: Web フォントは端末のフォントになる。Shape の中の画像（`<img>`）は、ページが中身を読めるもの（読み込み済みで、同じオリジンか CORS 付き）だけを `data:` URL にして入れ、読めないものは入らない。ブラウザによっては画像を GPU に載せられず、代わりの四角のままになる
- 3D の見た目を持つ Shape（立てる・箱・浮かせる）は、CSS 3D レンダラーと同じものを同じ形に立てる（どれを立てるかは shared の `selectView3dShapes`、プラグインが `view3dShapeSourceService` で渡した種別と上限も読む）。こちらは深度を持つので、丘の陰の Shape は丘に隠れ、Shape どうしも前後で隠し合う。種別の `render3d`（React の絵）は使わず、決まった形で描く

## Install

```bash
pnpm add @edv4h/usketch-gpu3d-renderer @edv4h/usketch-shared react
```

## 使い方

CSS 3D レンダラーの **代わりに**、3D ビュー（Mode 7）より前に追加する。ボードにもう 3D レンダラーがあれば何もしない。

```ts
import { createGpu3dRendererPlugin } from "@edv4h/usketch-gpu3d-renderer";
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";

createApp({
	plugins: [
		createDomRendererPlugin(),
		createGpu3dRendererPlugin(),
		createMode7Plugin(),
	],
});
```

レンダラーは `view3dRendererService`（`@edv4h/usketch-shared`）で、どの 3D レンダラーでも同じ形で取れる（傾ける層・奥行きを持たせる層の変更、描いているかどうか）。

## プラグインから GPU に描く

自前の GL で描くプラグインは、ボードの描画フック `view3dGl(ctx.services)` に描画を登録する。GPU レンダラーがあればそのキャンバスに毎フレーム描かれ、無ければ呼ばれない（そのときは自分のキャンバスで描く）。

```ts
import { VIEW3D_DEPTH_GLSL, view3dGl } from "@edv4h/usketch-shared";

const gpu = view3dGl(ctx.services);
const off = gpu.register({
	id: "my-plugin:mesh",
	draw(frame) {
		// frame.gl / frame.matrix（viewMatrix）/ frame.view / frame.pixelRatio
		// 頂点シェーダーでは gl_Position = view3dPosition(uView * pos) で深度を揃える
	},
	release(gl) {
		// GL オブジェクトを解放
	},
});
gpu.isDrawing(); // GPU レンダラーが描いている間 true（自分のキャンバスは止める）
gpu.requestFrame(); // 見た目が変わったら次のフレームを頼む
```

深度は全員が `VIEW3D_DEPTH_GLSL` の `view3dPosition` で同じように入れる。地面は深度を書かない背景として最初に描かれる。
