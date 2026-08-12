---
"@edv4h/usketch-plugin-map": minor
---

map: 無限・手続き生成のベース地形（チャンク読み込み Phase 1 / #926）

ワールドマップを**実質無限**にする最初の段階。未設定セルを、seed とワールド座標の
**決定論的な純関数** `baseTerrainAt(seed, col, row)` で埋める。関数はどの座標でも定義され、
連続ノイズを world 座標でサンプルするため、**チャンク境界でシームレス**・**保存不要**
（未編集の地形は seed から再生成でき、無限に広げてもデータが増えない）。編集した差分は
従来どおりスパースな override として shape に残る。

- 新規 `base-terrain.ts`: `baseTerrainAt`（固定グローバル閾値で band 分類）＋チャンク単位の
  LRU キャッシュ＋`makeTerrainSampler`（override ?? base）。
- `map-layer.tsx`: 無限ベース描画パス（可視セル範囲のみ描画＝O(visible)、full/coarse 両対応、
  オートタイルは総関数 sampler 経由でチャンク境界の破綻なし）。空ボードでも描画。
- `tilemap-shape.ts`: `baseSeed?: number` を `tilemap` shape に追加。seed は**アプリローカルな
  render config ではなく shape（同期・永続対象）に持つ**ので、生成した世界は**リロードしても
  消えず、ボード上の全員に同期**される。
- `tilemap-shape.ts`: `baseGen?: BaseGenParams`（`version`＋`scale`/`seaLevel`/`gMin`/`gMax`）を
  shape に記録し、**生成契約を凍結**。既定値をチューニングしたりアルゴリズムを差し替えても、
  既存ボードは自分が生成された時のパラメータで描かれ続ける（未設定＝v1 として `resolveBaseGen`
  でフォールバック）。`baseTerrainAt`/`makeTerrainSampler` はこの params 駆動に変更。
- HUD「RPG マップ」の **「無限地形」トグル＋「シード」** は tilemap shape の `baseSeed`＋`baseGen`
  を読み書きする（無ければ空 tilemap を生成して stamp）。
- 決定論・分布・sampler・パラメータ凍結（`baseGen`）の単体テスト。

後続（Phase 2/3）で、編集差分のチャンク shape 化（独立同期）／サーバー空間ストリーミングを予定。
