# @edv4h/usketch-plugin-mode7

ファミコン/SNES の **Mode 7** のように、Canvas を「奥へ傾く地平面」として擬似3D視点で見る
**ビューモード**プラグイン。実際の Shape をそのまま傾けて表示する（編集ではなく閲覧）。ON/OFF トグル、既定 OFF。

## 仕組み

- `perspective()+rotateX(pitch)+rotateZ(yaw)` の **CSS 3D 変換を「板コンテンツ層」の外側ラッパ div に注入**する。
  各レイヤーは `canvas.tsx` で `data-layer-id` 付き div にラップされ、その外側 `transform` は React 非管理なので
  注入が再レンダで消えない（`MutationObserver` で層の増減にも追従）。コアの座標変換（affine `{x,y,zoom}`）には触れない。
- 傾ける対象は **allow 方式**（既定 `dom-shapes`/`gpu-shapes`/`bg-grid`/`bg-dots`/`island-metaball`）。
  HUD・選択ハンドル・各種バナー等の UI 層は傾けない。
- **sky / fog / capture** の3つの非傾斜オーバーレイ層を追加。capture 層が板のポインタを捕捉して
  3D 下での編集破綻を防ぎ、ドラッグ=地上移動（viewport pan）・wheel=ズームでカメラを操作する。
- 状態は**ビュー限定（per-viewer・非永続・非同期）** ＝ shape 化しない（presentation と同類）。

## 使い方

```ts
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";

createApp({
  plugins: [
    // …renderer / 各 shape プラグインと一緒に登録する
    createMode7Plugin({
      enabledInitially: false,          // 既定 OFF（HUD/サービスで opt-in）
      camera: { pitch: 55, fov: 600 },  // 初期カメラ（部分指定可）
      look: { sky: "#0b1026", fog: 0.35 },
      // tiltLayerIds: [...],           // 傾ける層を上書き
      // shortcuts: { toggle: "…" },    // キーバインド（opt-in・既定なし）
    }),
  ],
});
```

有効化は HUD の「3Dビュー切替」アクション、サービス `getMode7Api(app.services)?.toggle()`、
またはイベント `app.events.emit("mode7:toggle")` のいずれでも可能。

## カメラ

| パラメータ | 意味 | 範囲 |
| --- | --- | --- |
| `pitch` | 地平面の傾き（0=真上, 大=斜め） | 0–85° |
| `yaw` | 旋回（進行方向の回転） | -180–180° |
| `fov` | CSS `perspective()` 距離（小=遠近強） | 200–2000px |
| `horizon` | 地平線の画面高さ割合（ピボット） | 0.1–0.9 |

見た目: `sky`（空色）/ `fog`（フォグ濃度 0–1）/ `fogColor`。

## アクション（`mode7:<key>` で emit・HUD Controls に自動表示・サービス）

`toggle` / `pitch-up` / `pitch-down` / `yaw-left` / `yaw-right` / `fov-narrow` / `fov-wide` / `reset`。

ショートカットは **opt-in・既定なし**（共有レジストリは `event.key` 照合で macOS の Option+英字合成 /
Shift+数字変換に弱く、既定を持たせると layout により無反応になるため）。`shortcuts` オプションで任意に割当。

## サービス API

```ts
import { getMode7Api } from "@edv4h/usketch-plugin-mode7";
const api = getMode7Api(app.services);
api?.toggle();
api?.setPitch(60);
api?.setYaw(30);
```

`Mode7Api`: `isActive` / `enable` / `disable` / `toggle` / `getCamera` / `setPitch` / `setYaw` /
`setFov` / `setHorizon` / `adjust` / `getLook` / `setSky` / `setFog` / `setFogColor` / `reset` / `onChange`。

## スコープ外（v2 送り）

3D 中の編集（perspective 逆投影して `screenToWorld` を補正）／WebGPU 真3D／Shape の billboard 立て起こし／
視差・霧・地平線もやの高度化／minimap の3Dプレビュー。
