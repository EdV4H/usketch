# @edv4h/usketch-plugin-viewport-nav

ビューポート操作（ズーム / パン）を提供するプラグイン。

- **ズーム**: `Ctrl`/`Cmd` + ホイール（トラックパッドのピンチ含む）でカーソル位置を中心に拡大・縮小。
- **パン**: ホイール（修飾キー無し）、および中ボタンドラッグ。

## 使い方

```ts
import { createViewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";

// 既定（従来どおりの体感）
createViewportNavPlugin();

// ズーム感度を上げる
createViewportNavPlugin({ zoomSensitivity: 2.5 });
```

## オプション

```ts
interface ViewportNavOptions {
  /**
   * ホイール/トラックパッドのズーム感度。`1` が既定で従来相当。
   * 大きいほど 1 操作あたりの倍率変化が大きくなる（0.25〜3 にクランプ）。
   * 値だけでなく「ライブに読む getter」も渡せる（設定 UI からの即時反映用）。
   */
  zoomSensitivity?: number | (() => number);
}
```

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
