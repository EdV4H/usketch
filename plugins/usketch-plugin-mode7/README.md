# @edv4h/usketch-plugin-mode7

ファミコン/SNES の **Mode 7** のように、Canvas を「奥へ傾く地平面」として擬似3D視点で見る
**ビューモード**プラグイン。実際の Shape をそのまま傾けて表示する（編集ではなく閲覧）。ON/OFF トグル、既定 OFF。

## 仕組み

- `perspective()+rotateX(pitch)+rotateZ(yaw)` の **CSS 3D 変換**を、`document.head` に挿した単一の `<style>`
  シート（`!important` ルール）で「板コンテンツ層」の外側ラッパ div に当てる。各レイヤーは `canvas.tsx` で
  `data-layer-id` 付き div にラップされ、ルールは `data-mode7-stage="on"` を付けたメインコンテナ配下に
  スコープされる。コンテナ検出は **`data-testid` ではなく `[data-layer-id]` の親**で行う（`data-testid` は
  ビルドで除去され実行時に存在しないため）。スタイルシート方式なので React の再レンダで消えず、後からマウント
  する層にも適用され、per-element の注入も `MutationObserver` も要らない。コアの座標変換（affine `{x,y,zoom}`）には触れない。
- 傾ける対象は **allow 方式**で、既定は「**固定UIクロム以外のほぼ全層**」（背景/Shape/GPU に加え、
  選択・コネクタ・各種オーバーレイ層も含む。除外は `vim-status-line`/`vim-which-key`/`vim-help`/
  `side-panel`/`presentation-overlay` の固定UI）。**HUD の「Mode 7 レイヤー」パネルから実行時に選択できる**
  （例: Shape 層のオン/オフ）。HUD 自身やプラグインの sky/fog/capture 層は選択肢から除外され、絶対に
  傾かない（`skipLayerIds` で除外を追加可）。既定一覧は `DEFAULT_TILT_LAYER_IDS` を参照。
- **sky / fog / capture** の3つの非傾斜オーバーレイ層を追加。capture 層が板のポインタを捕捉して
  3D 下での編集破綻を防ぎ、ドラッグ=地上移動（viewport pan）・wheel=ズームでカメラを操作する。
- **取り込み範囲（capture frame）**: 3Dビューが地面として映すのは「切替時のビューポート世界矩形」だけで、
  その外の Shape は初期3Dビューに出ない（本方式は遠方を描画しない＝現ビューポート分のみ。前進パンで到達は可）。
  これを可視化するため、切替 ON の瞬間にビューポート世界矩形をスナップショットし、**フラットモードで
  ワールド固定の破線枠**として描く（HUD トグル `取り込み範囲` / アクション `取り込み範囲の表示切替` で ON/OFF）。
  枠外の Shape が一目で分かるので、切替前の配置調整に使える。枠自体は非傾斜・非固定レイヤーで shape 化しない。
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

**箱クリップ（常時）**: tilt 層は `overflow:visible`（3D保持のため）で描くので、放置すると背景グリッド
（`bg-grid`=ビューポート箱ぶんしか描かない）の外＝地平線より上まで Shape が露出し、グリッドの無い空中に
浮いて見える。これを防ぐため、アクティブ時は各 tilt 層を **常に `clip-path: inset(0)` で箱にクリップ**し、
Shape がグリッドと同じ範囲でピタッと切れるようにしている（`clip-path` は `overflow` と違い 3D を潰さない）。

**描画距離（`drawDistance`, HUD「描画距離(Canvas)」）**: その箱クリップの**上端をさらに手前へ詰める**設定。
近端（画面下＝カメラ手前）から**Canvas（ワールド）単位**でどこまで地面を描くか。`0`=箱いっぱい（既定）、
正の値でその距離より遠くをカット＝遠くの散らばった Shape や地平線際のクラッタを消せる。`distance * zoom`
px 分を近端に残す（ズーム変化に追従＝`viewport:changed` で再適用）。カット線はフォグ併用でぼける。
※ Shape は DOM 上には残る（コアのカリングではなく描画クリップ）ので、真のジオメトリ間引きは別途。

## アクション（`mode7:<key>` で emit・HUD Controls に自動表示・サービス）

`toggle` / `pitch-up` / `pitch-down` / `yaw-left` / `yaw-right` / `fov-narrow` / `fov-wide` / `reset` /
`capture-frame`（取り込み範囲の表示切替）。

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
`setFov` / `setHorizon` / `adjust` / `getLook` / `setSky` / `setFog` / `setFogColor` / `reset` /
`getTiltLayers` / `setTiltLayers` / `toggleTiltLayer` / `getDrawDistance` / `setDrawDistance` /
`isCaptureFrameVisible` / `setCaptureFrameVisible` / `toggleCaptureFrame` / `getCaptureRect` / `onChange`。

## スコープ外（v2 送り）

3D 中の編集（perspective 逆投影して `screenToWorld` を補正）／WebGPU 真3D／Shape の billboard 立て起こし／
視差・霧・地平線もやの高度化／minimap の3Dプレビュー。
