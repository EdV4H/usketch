# @edv4h/usketch-plugin-viewport-nav

ビューポート操作（ズーム / パン）を提供するプラグイン。

- **ズーム**: `Ctrl`/`Cmd` + ホイール（トラックパッドのピンチ含む）でカーソル位置を中心に拡大・縮小。
- **パン**: ホイール（修飾キー無し）、および中ボタンドラッグ。

- **マウスとトラックパッドで別々の感度**: ホイール操作がマウスかトラックパッドかを推定し、
  それぞれのスクロール速度・ズーム速度を使う。利用者は HUD から変えられる（localStorage に保存）。

## 使い方

```ts
import { createViewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";

// 既定（従来どおりの体感）
createViewportNavPlugin();

// ズーム感度を上げる（マウス / トラックパッド共通）
createViewportNavPlugin({ zoomSensitivity: 2.5 });

// マウスはスクロールを速く、トラックパッドはピンチを速く
createViewportNavPlugin({
  mouse: { panSensitivity: 2 },
  trackpad: { zoomSensitivity: 3 },
});
```

## オプション

```ts
interface ViewportNavOptions {
  /** ズーム感度（両デバイス共通）。`1` が既定で従来相当。0.25〜6 にクランプ。getter も可。 */
  zoomSensitivity?: number | (() => number);
  /** スクロール（パン）感度（両デバイス共通）。`1` が既定で delta そのまま。0.1〜5 にクランプ。getter も可。 */
  panSensitivity?: number | (() => number);
  /** マウスホイールだけの感度。指定した項目は共通の値より優先。 */
  mouse?: { zoomSensitivity?: Live<number>; panSensitivity?: Live<number> };
  /** トラックパッドだけの感度。指定した項目は共通の値より優先。 */
  trackpad?: { zoomSensitivity?: Live<number>; panSensitivity?: Live<number> };
  /** "auto"（既定・イベントごとに推定）/ "mouse" / "trackpad"（固定）。getter も可。 */
  deviceMode?: Live<"auto" | "mouse" | "trackpad">;
  /** zoomSensitivity のクランプ範囲。既定 { min: 0.25, max: 6 }。 */
  zoomSensitivityRange?: { min?: number; max?: number };
  /** panSensitivity のクランプ範囲。既定 { min: 0.1, max: 5 }。 */
  panSensitivityRange?: { min?: number; max?: number };
  /** HUD に感度の設定を出すか。既定 true。自前の設定画面を持つホストは false に。 */
  hud?: boolean;
  /** 利用者の上書きの保存先。既定は localStorage の "usketch:viewport-nav"。false で保存しない。 */
  storage?: ViewportNavStorage | false;
}
```

感度の優先順位は **利用者の上書き（HUD / サービス） > デバイス別 options > 共通 options > 1**。
min > max などの破綻したクランプ範囲は無視して既定にフォールバックする。

### マウスとトラックパッドの見分け方

ブラウザは発生元デバイスを教えてくれないので、`canvas:wheel` の値から推定する（`guessWheelDevice`）。

1. `deltaMode` が行/ページ単位 → マウス（Firefox のマウスホイール）
2. 縦横同時に動いている → トラックパッド
3. 非標準の `wheelDeltaY`（Chrome / Safari / Edge）が `-3 × deltaY` → トラックパッド、±120 刻みなど → マウス
4. delta が小数 → トラックパッド

1 回のスクロールやピンチの途中で判定が揺れないよう、250ms 以内に続くイベントは同じ判定を引き継ぐ
（`createWheelDeviceDetector`）。推定が外れる環境では HUD の「入力デバイス」か `deviceMode` で固定できる。

Safari のトラックパッドのピンチは wheel ではなく `gesture*` イベントで届き、canvas-engine が直接ズームするため、
トラックパッドのズーム速度は効かない（Chrome / Edge / Firefox のピンチは効く）。

### ホストから設定を読み書きする

```ts
import { getViewportNavApi } from "@edv4h/usketch-plugin-viewport-nav";

const nav = getViewportNavApi(app.services);
nav?.setSettings({ mouse: { pan: 2 }, trackpad: { zoom: 3 } });
nav?.getSettings(); // { deviceMode, mouse: { pan, zoom }, trackpad: { pan, zoom } }
nav?.getLastDevice(); // 直近の操作の判定 "mouse" | "trackpad" | null
nav?.resetSettings(); // 利用者の上書きを消す
```

操作ロジックは `applyWheelToViewport(store, event, { pan, zoom })` として公開している。

### ズーム量の算出

ズーム係数は `deltaY` の**大きさ**に比例する:

```
factor = exp(-deltaY * 0.001 * zoomSensitivity)
```

- 従来は `deltaY` の符号だけで `0.9 / 1.1` に固定していたため、小さい `deltaY` を大量に出す
  トラックパッドのピンチと `deltaY≈±100` のマウスホイールとで体感速度が大きく異なっていた。
  比例式にすることで両者の差が縮まり、ピンチも滑らかになる。
- `zoomSensitivity` 省略時（=1）は `deltaY≈100` で `factor≈0.905`、`deltaY≈-100` で `≈1.105` と
  なり、**従来の 0.9 / 1.1 とほぼ同じ**（後方互換）。

### ライブ反映（getter 形式）

設定 UI のスライダー等で感度を即時反映したい場合は getter を渡す。wheel イベントごとに評価される。

```ts
let zoomSensitivity = 1;
createViewportNavPlugin({ zoomSensitivity: () => zoomSensitivity });
// 以降 zoomSensitivity を書き換えれば次のズームから反映される
```

### クランプ可動域の上書き

既定のクランプは `{ min: 0.25, max: 6 }`。タッチ/トラックパッド主体で更に速くしたい等、
ホスト側でスライダーの可動域を決めたい場合は `zoomSensitivityRange` で上書きできる。

```ts
// 最速を s=10 まで許容する
createViewportNavPlugin({
  zoomSensitivity: () => hostSlider.value, // 例: 0.25〜10 のスライダー
  zoomSensitivityRange: { max: 10 },
});
```

範囲は setup 時に一度だけ解決される（`zoomSensitivity` の getter は wheel ごとに評価）。
