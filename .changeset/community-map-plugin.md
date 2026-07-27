---
"@edv4h/usketch-plugin-map": minor
---

RPG マップ・タイルペイントプラグイン `@edv4h/usketch-plugin-map` を新規追加。

デザイン「手描きRPGマップ・素材」の語彙を uSketch の layer/shape/tool 機構に実装:

- **地形タイルペイント**: 12 種の地形（草原/森/水辺/砂漠/山/道/雪原/沼地/溶岩/石床/畑/花畑）を
  40×40 グリッドにブラシで塗る。外周（辺）が一段濃くなるオートタイル。ブラシ / 消しゴム / 塗りつぶし。
- **アイコン 36 種**（ランドマーク12・オブジェクト12・マーカー12）をパレットから選んでスタンプ配置。
- **Tweaks**: カラフル⇔モノクロ、揺らぎ線⇔クリーン線、線の太さ（パレット＋Control HUD 両対応）。

アーキテクチャ: 地形の描画は専用 **MapLayer**（全 shape の背面）、地形データは data-only の
`tilemap` shape に保持（shape ストア経由で Yjs 同期・Undo が無料。`island` と同じ
「データは shape・描画は layer」パターン）。アイコンは通常の選択可能な `map-icon` shape。
SVG 素材は `dangerouslySetInnerHTML` 不使用（パース済みノード木を React で描画）。

community ページ（ワールドマップ空間）の基本プラグインに組み込み（`createMapPlugin()`）。
ツール `map`（ショートカット `m`、アバターのラジアルメニューにも表示）。
