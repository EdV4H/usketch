---
"@edv4h/usketch-plugin-map": minor
---

territory の範囲描画に完全カスタムフック `region.render` を追加 (#990)。

`label.render` と同じく、レイヤーが位置決め・ビューポート追従・重なり順・`show` 連動・再描画を担い、ホストは見た目だけを返せる。`region.render(region)` が設定されると、full detail 時はストックの塗り/枠/リングの代わりにホストの SVG を各領域に描画する（coarse LOD はストックのブロックのまま）。ワールド座標の SVG を返す（レイヤーがビューポート変換を適用）。`null` を返すとその領域は描画しない。

ホストが描画に必要なジオメトリを渡す新しい `TerritoryRegion` 型（`baseRegions()` で取得）:

- `baseId` / `name` / `color` / `anchor{x,y}`（bbox 中心・ワールド）/ `count`
- `cells`（cellKey 群）/ `tile` / `bounds`（ワールド bbox）
- `beaconCell` / `radius`（リング描画用）
- `outline`（露出エッジの SVG パス・ワールド座標。枠線描画用）

`TerritoryRegion` と `baseRegions` を公開 export に追加。
