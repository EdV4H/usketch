# @edv4h/usketch-plugin-map

RPG マップ・タイルペイントプラグイン。community ページ（ワールドマップ空間）で、
手描きワイヤーフレーム調の地形タイルを塗り、ランドマーク/オブジェクト/マーカーの
アイコンを配置できる。

## 特徴

- **地形タイルペイント**: 12 種の地形（草原/森/水辺/砂漠/山/道/雪原/沼地/溶岩/石床/畑/花畑）を
  40×40 グリッドにブラシで塗る。隣接判定で外周（辺）が一段濃くなるオートタイル。
  ブラシ / 消しゴム / 塗りつぶし（flood-fill）。
- **アイコン 36 種**: ランドマーク12・オブジェクト12・マーカー12 をパレットから選んでスタンプ配置。
- **Tweaks**: カラフル⇔モノクロ、揺らぎ線⇔クリーン線、線の太さ。パレットと Control HUD の両方から。

## アーキテクチャ

- **地形の描画は MapLayer**（`ctx.layers`, 低 `order` で全 shape の背面）。
- **地形データは data-only の `tilemap` shape** に保持 → shape ストア経由で Yjs 同期・Undo が無料。
  `tilemap` は描画を持たず（`render` は空の `<g/>` を返す）/ `hitTest:()=>false` / `locked` で
  選択対象にならない substrate。
- **アイコンは通常の `map-icon` shape**（選択・移動・リサイズ可、前面）。
- SVG 素材は `dangerouslySetInnerHTML` を使わず、パース済みノード木（`svg-nodes.tsx`）を
  `React.createElement` で描画（XSS 安全・リポジトリ方針に準拠）。

## 使い方

```ts
import { createMapPlugin } from "@edv4h/usketch-plugin-map";

const plugins = [
  // ...community base plugins
  createMapPlugin({ tile: 40, defaultColorMode: "color", defaultLineStyle: "wobble" }),
];
```

ツール `map`（ショートカット `m`、アバターのラジアルメニューにも表示）を選ぶとパレットが開く。

## オプション（`createMapPlugin`）

| option | default | 説明 |
|---|---|---|
| `tile` | `40` | タイル辺（world 単位） |
| `defaultColorMode` | `"color"` | 初期配色（`color` / `mono`） |
| `defaultLineStyle` | `"wobble"` | 初期線種（`wobble` / `clean`） |

## ツール状態の公開 API（#927 / v0.6.0）

Control HUD（`debug-hud`）以外の**ホスト独自 UI**（ActionRing / ラジアルメニュー / 独自ツールバー）
からツールの mode / terrain / icon を切り替えられるよう、内部の app-local reactive store を公開している。
`renderConfigStore` と同じ **public reactive store（`get()` / `set(patch)` / `subscribe()`）** パターン。
いずれも同期対象外（presentation/interaction state）。

| export | 内容 |
|---|---|
| `toolStateStore` / `MapToolState` / `useMapToolState()` | `mode` / `terrain` / `iconKey` / `excludeTerrains` |
| `MAP_MODES` | モードの順序付き配列（`brush\|eraser\|fill\|region\|stamp\|generate\|base`）。`MapMode` はここから派生（実行時に列挙可能） |
| `rangeEraseStore` / `RangeEraseTargets` / `useRangeEraseTargets()` | 範囲消しの対象 |
| `genStateStore` / `GenState` / `WorldRect` / `useGenState()` | 生成 UI（アルゴリズム / seed / params / ドラッグ矩形） |
| `baseStateStore` / `BaseToolState` / `useBaseState()` | 拠点ツールの選択状態 |
| `ReactiveStore` | 各 store の共通インターフェース |
| `TERRAINS` / `ICONS` | 既存 export（terrain / icon の定義一覧） |

```tsx
import { toolStateStore, MAP_MODES, TERRAINS, useMapToolState } from "@edv4h/usketch-plugin-map";

// 独自 ActionRing から直接セット
toolStateStore.set({ mode: "brush", terrain: "grass" });

// React で購読
function ModePicker() {
  const { mode } = useMapToolState();
  return MAP_MODES.map((m) => (
    <button key={m} aria-pressed={m === mode} onClick={() => toolStateStore.set({ mode: m })}>
      {m}
    </button>
  ));
}
```
