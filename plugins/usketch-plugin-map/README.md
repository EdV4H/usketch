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
