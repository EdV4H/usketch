---
"@edv4h/usketch-plugin-map": minor
---

map: 領域塗り／塗りつぶしを無限ベース地形に対応（sampler ベース＋上限で安全化）

無限ベース地形（`baseSeed`）が有効なとき、塗りつぶし／領域塗りが**未編集セルの見た目どおりの
地形（sampler = override ?? base）**を対象に flood するようになった。従来はスパースな override
（`cells`）だけを見ていたため、生成された地形の上ではまともに塗れなかった。

- 新規 `samplerFloodFill(sample, startCol, startRow, maxCells)`（`autotile.ts`）: サンプラ上を
  **幅優先**で flood。無限に連結しうるので `maxCells`（8192）で上限を設け、上限に達したら
  `truncated` を返す。
- `map-tool` の `doFill` / `doRegionFill`: 無限ベースが有効なら sampler 経路を使い、**囲まれた
  領域（上限内で自然終了）はそのまま塗り、囲まれていない開けた地形（上限到達）は塗らずに中止**
  （`map:fill-aborted` イベントを発火）。有限ボードの従来挙動は不変。
- 単体テスト（enclosed 充填・open 打ち切り・BFS・sampled 地形の尊重）を追加。

後続: 中止時のユーザー通知（HUD トースト）と、`emptyTerrain`（無限の海）モードへの拡張。
