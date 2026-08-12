---
"@edv4h/usketch-plugin-map": minor
---

map: 無限ベース地形を HUD 以外から制御できる公開 API（#946 / #937 follow-up）

`#937` の無限ベース地形（`tilemap.baseSeed`）を、Control HUD の「無限地形」トグルに依存せず
**ホスト独自 UI から enable/disable/seed** できるようにする公開 API を追加。seed は shape に載る
同期状態なので、`renderConfigStore` のような module-scoped store ではなく **`BoardStore` を受け取る
関数**として提供する。HUD のトグルもこの API を呼ぶよう変更し、実装を一本化。

- `infinite-terrain.ts`: `enableInfiniteTerrain(store, { seed?, tile? })` / `disableInfiniteTerrain(store)` /
  `getInfiniteSeed(store)` / `isInfiniteTerrainEnabled(store)` / `setInfiniteSeed(store, seed|null)` /
  `DEFAULT_INFINITE_SEED`。HUD と同じロジック（seededTilemap ?? lowestTilemap ?? 生成、`baseGen` 凍結、
  seed 整数丸め、決定論的ターゲット選択）。
- `use-infinite-terrain.ts`: `useInfiniteTerrain(store)` — reactive な `seed`＋`enable/disable/setSeed`
  を返す React hook（issue の option 1 の使い勝手）。shape 変更のみ購読（pan/zoom では再描画しない）。
- index から re-export: 上記 API に加え、issue が挙げた `seededTilemap` / `lowestTilemap` / `isTileMap` /
  `makeTileMap` / `resolveTilemap` / `DEFAULT_BASE_GEN` / `baseTerrainAt` / `BaseGenParams`。
- 公開 API の単体テストを追加。
