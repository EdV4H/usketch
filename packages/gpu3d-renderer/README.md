# @edv4h/usketch-gpu3d-renderer

ボードの 3D 表示（コアの `View3dState`）を WebGL2 の 1 枚のキャンバスで描くレンダラー（**実験中**）。CSS 3D レンダラーの代わりに使う。地面・地形・その上に立つものを深度バッファ付きの 1 枚に描くので、前後の重なりが正しくなる。

今のバージョンで描くのは **地面（背景色とグリッド）と、GPU で描くプラグイン（標高の地形）** まで。描いている間、3D で見せる層（`view3d` が `tilt` / `depth` / `ground` の層）は隠れるので、Shape やキャラは見えない（次の段階で GPU に描く）。CSS 3D レンダラーと見比べるためのもので、既定には使わない。

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
