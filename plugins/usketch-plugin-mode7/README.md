# @edv4h/usketch-plugin-mode7

ファミコン/SNES の **Mode 7** のように、Canvas を「奥へ傾く地平面」として擬似3D視点で見る
**ビューモード**プラグイン。実際の Shape をそのまま傾けて表示する（編集ではなく閲覧）。ON/OFF トグル、既定 OFF。

## 仕組み

- `perspective()+rotateX(pitch)` の **CSS 3D 変換**を、`document.head` に挿した単一の `<style>`
  シート（`!important` ルール）で「板コンテンツ層」の外側ラッパ div に当てる。各レイヤーは `canvas.tsx` で
  `data-layer-id` 付き div にラップされ、ルールは `data-mode7-stage="on"` を付けたメインコンテナ配下に
  スコープされる。コンテナ検出は **`data-testid` ではなく `[data-layer-id]` の親**で行う（`data-testid` は
  ビルドで除去され実行時に存在しないため）。スタイルシート方式なので React の再レンダで消えず、後からマウント
  する層にも適用され、per-element の注入も `MutationObserver` も要らない。コアの座標変換（affine `{x,y,zoom}`）には触れない。
- 傾ける対象は **allow 方式**で、既定は「**固定UIクロム以外のほぼ全層**」（背景/Shape/GPU に加え、
  選択・コネクタ・各種オーバーレイ層、`usketch-plugin-character` の `character` 層も含む。除外は `vim-status-line`/`vim-which-key`/`vim-help`/
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
      // depthLayerIds: [...],          // 本当に奥行きを持たせる層（既定 DEFAULT_DEPTH_LAYER_IDS）
      // shortcuts: { toggle: "…" },    // キーバインド（opt-in・既定なし）
      // transition: { durationMs: 900, easing: "ease-in-out" }, // 切替アニメ（既定 0＝即時）
    }),
  ],
});
```

有効化は HUD の「3Dビュー切替」アクション、サービス `getMode7Api(app.services)?.toggle()`、
またはイベント `app.events.emit("mode7:toggle")` のいずれでも可能。

### 切替アニメーション（`transition`）

`transition.durationMs` を指定すると、ON/OFF が**アニメーション**になる（既定 `0`＝従来どおり即時）。

- **ON**: 地面が平ら（pitch 0）から `camera.pitch` までせり上がり、空・フォグがフェードイン。
- **OFF**: 逆再生し、平らに戻りきってから非アクティブになる（それまで capture 層が編集を塞ぐ）。
- 途中で切り替えると、**今の状態から逆再生**（ジャンプしない）。
- 保存されたカメラ/見た目は常に目標値のまま。アニメするのは描画値だけ（pitch と、viewport を回す yaw を
  遷移量でスケール、空/フォグは不透明度、描画距離の手前切り取りも同率でフェード）。
- 1 フレームにつき store 更新は 1 回。`prefers-reduced-motion` なら終了状態へ即時。
- 呼び出し単位で上書き可: `api.enable({ animate: true })` / `api.disable({ animate: false })`。
  `durationMs` 未設定で `animate: true` の場合は 900ms。
- `api.isTransitioning()` / `api.getTransitionAmount()`（0…1）で進行中かを取れる。`onChange` は
  遷移中も毎フレーム発火するので、ホスト側のオーバーレイを同期できる。

## カメラ

| パラメータ | 意味 | 範囲 |
| --- | --- | --- |
| `pitch` | 地平面の傾き（0=真上, 大=斜め） | 0–85° |
| `yaw` | 旋回（進行方向の回転）。3D の間は viewport の回転（`Viewport.rotation`）として地平線の中央を軸に回し、平らに戻るときに回した分だけ戻す | -180–180° |
| `fov` | CSS `perspective()` 距離（小=遠近強） | 200–2000px |
| `horizon` | 地平線の画面高さ割合（ピボット） | 0.1–0.9 |

見た目: `sky`（空色）/ `fog`（フォグ濃度 0–1）/ `fogColor`。

**描画距離（`drawDistance`, HUD「描画距離(Canvas)」）**: 近端（画面下＝カメラ手前）から**Canvas
（ワールド）単位**でどこまで地面を描くか。tilt 層は `overflow:visible`（3D保持のため）で描くので、
`clip-path` でこの距離にクリップして境界を作る（`clip-path` は `overflow` と違い 3D を潰さない）。

既定は **1500**（開いた瞬間に地面が少し奥まで敷かれる）。`0`=**auto**＝ビューポート箱で切る。

- `0`(auto) → 箱で切る。箱の外に Shape が露出せず、グリッド（`bg-grid`）と同じ範囲でピタッと切れる（浮かない）。
- **箱内の距離** → その手前だけ残す（遠方の散らばりを消す・近距離クローズアップ）。
- **箱を超える距離** → クリップを**全方向へ**負 inset で広げ（上=奥, 左右=扇状に広がる地面, 画面外は
  canvas-container が clip）、**同時に `bg-grid:set-overscan` イベントでグリッドを箱外へ延長**する
  （延長px = `distance*zoom - 箱高 + 余白`）。これで grid と Shape が一緒に奥＋横へ伸び、遠方 Shape の
  下にもグリッドが敷かれる（専用グリッド不要）。`viewport:changed` でズームにも追従。

※ Shape は DOM 上には残る（コアのカリングではなく描画クリップ）ので、真のジオメトリ間引きは別途。

3D 表示の開始・終了時には `usketch:stage-3d` イベント（`{ active }`、`STAGE_3D_EVENT`）を出す。
また、shared の `view3dService`（遷移量 `amount()` と描画中のカメラ `camera()`、`subscribe`）を提供する。Mode 7 に依存せずに「地面と一緒に起き上がる」ものを作るときはこちらを読む（`usketch-plugin-shape-3d` が使用）。map プラグインはこれを見て、段差（立体）を 3D 表示中だけ組み立てる。

**深度レイヤー（`depthLayerIds`）**: `clip-path` は傾き自体は保つが、配下の奥行き（`translateZ`）を
平面に潰す。そこで深度レイヤーはこのクリップを外し、エンジンの内側ラッパーにも
`transform-style: preserve-3d` を付けて 3D 文脈を通す。既定 `DEFAULT_DEPTH_LAYER_IDS` は
`usketch-map:relief`（map プラグインの高いセルの崖と上面）、`shape-3d`（`usketch-plugin-shape-3d` が立てた Shape）と `character`（その上に立つキャラ）。
深度レイヤーは描画距離のクリップを受けない。

## アクション（`mode7:<key>` で emit・HUD Controls に自動表示・サービス）

`toggle` / `pitch-up` / `pitch-down` / `yaw-left` / `yaw-right` / `fov-narrow` / `fov-wide` / `reset` /
`capture-frame`（取り込み範囲の表示切替）。

キーは **opt-in・既定なし**（どの文字キーも、どこかのツールや配列とぶつかるため）。各アクションはキーなしの
keymap binding（id `usketch-plugin-mode7:<key>`）として登録されるので、キー設定に並び、ホストは
`createApp({ keymap: { keys: { "usketch-plugin-mode7:toggle": ["Alt+M"] } } })` で割り当てる。
`shortcuts` オプションも動くが非推奨（次のメジャーで削除）。

## サービス API

```ts
import { getMode7Api } from "@edv4h/usketch-plugin-mode7";
const api = getMode7Api(app.services);
api?.toggle();
api?.setPitch(60);
api?.setYaw(30);
```

`Mode7Api`: `isActive` / `enable` / `disable` / `toggle`（各 `{ animate? }`）/ `isTransitioning` /
`getTransitionAmount` / `getCamera` / `getRenderedCamera` / `setPitch` / `setYaw` /
`setFov` / `setHorizon` / `setHeight` / `getHeightKeys` / `setHeightKeys` / `getHeightSpeed` / `setHeightSpeed` / `adjust` / `getLook` / `setSky` / `setFog` / `setFogColor` / `reset` /
`getTiltLayers` / `setTiltLayers` / `toggleTiltLayer` / `getDrawDistance` / `setDrawDistance` /
`isCaptureFrameVisible` / `setCaptureFrameVisible` / `toggleCaptureFrame` / `getCaptureRect` / `onChange`。

## カメラの高さ

`Camera.height`（ワールド単位、`0` = ボードの高さ）でカメラを上げると、すべてがその分だけ下に
描かれ、その高さの地面が平らなボードと同じ位置に見える。`setHeight(height)` または
`setCamera` 相当の `{ height }` で変える。カメラの横の位置はボードの viewport（スクロール位置）。
高い山を歩くキャラクターが画面の上へ抜けないよう、追いかける側が毎フレーム足元の地面の高さを
（自分でなめらかにして）渡す。`@edv4h/usketch-plugin-character` は
`view3dService.setCameraHeight` を通して自動でこれを行う。描画上の上げ幅は
`getRenderedCamera().heightPx`（px = 高さ × zoom × 遷移量）。WebGL などで自前に描く場合は
これを引いてから投影する（`projectToGround` は `heightPx` を見る）。

3D ビューのあいだは **Space を押している間カメラが上がり、Shift で下がる**（画面上で毎秒
`heightSpeed` px、既定 480）。キーは keymap の `"hold"` binding（`HEIGHT_KEY_IDS` =
`usketch-plugin-mode7:camera-up` / `camera-down`、`KeyboardEvent.code`）で、既定は `heightKeys` オプション
（`{ up?, down? }`、`false` でキーなし）。ホストは `createApp({ keymap: { keys } })`、閲覧者は
`keymap.setKeys` で付け替える（`setHeightKeys` / `getHeightKeys` は非推奨のラッパー）。入力欄・ボタン・
スライダーにフォーカスがあるときは動かない。同じキーの binding がほかにあれば keymap が振り分け、
高さキーの priority（`HEIGHT_KEY_PRIORITY` = 10）はツールより上・キャラクターより下（キャラクターの
ジャンプが Space を取る）。
キャラクターが追いかけている間は、キャラクターがカメラの高さを毎フレーム決めるので、高さキーは keymap 上でも無効になる
（`view3dService.setCameraHeight` が最後に呼ばれてから `HEIGHT_DRIVER_HOLD_MS` = 250ms の間。
両方が毎フレーム高さを書き換えて画面がガタガタしないように）。

## 地面上の点の投影

地面の上に物を描く（車・スプライト・タイヤ痕）ときや、画面の点から地面の点を求めるときは、
CSS 変換を自前で組まずに次の純関数を使う。座標はキャンバス左上基準の px（傾ける前の平面 ↔ 画面）。

```ts
import { getMode7Api, projectToGround, unprojectFromGround } from "@edv4h/usketch-plugin-mode7";
const cam = getMode7Api(app.services)?.getRenderedCamera(); // 遷移中は傾きが縮んだカメラ
const size = { width, height };                              // キャンバスの px サイズ
projectToGround(sx, sy, cam, size, z);   // → { x, y, depth, scale } | null（目の後ろ）
unprojectFromGround(x, y, cam, size, z); // → { x, y } | null（地平線より上）
// z = 地面からの高さ（px、省略で 0）。cam.heightPx（カメラの高さ）は両方が自動で差し引く。
```

## スコープ外（v2 送り）

3D 中の編集（perspective 逆投影して `screenToWorld` を補正）／WebGPU 真3D／
視差・霧・地平線もやの高度化／minimap の3Dプレビュー。

Shape を立てて描くのは `@edv4h/usketch-plugin-shape-3d`（別プラグイン）。
