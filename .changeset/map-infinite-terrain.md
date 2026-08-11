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
- `render-config.ts`: `baseSeed: number | null`（`renderConfigStore` から公開・#927 の API で駆動可）。
- HUD「RPG マップ」に **「無限地形」トグル＋「シード」** を追加。
- 決定論・分布・sampler の単体テスト。

後続（Phase 2/3）で、編集差分のチャンク shape 化（独立同期）／サーバー空間ストリーミングを予定。
