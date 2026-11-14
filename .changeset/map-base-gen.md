---
"@edv4h/usketch-plugin-map": minor
---

Let hosts and the HUD choose how the infinite terrain is generated: `enableInfiniteTerrain({ gen: { scale, seaLevel } })` (smaller `scale` ⇒ wider land / forest / mountain regions at the same tile size; larger `seaLevel` ⇒ more sea), plus `getInfiniteGen` / `setInfiniteGen` / `setInfiniteRegion` (also on `getMapApi`) and the `regionSizeOf` / `scaleForRegionSize` / `REGION_SIZE_RANGE` helpers. The params are recorded on the board's tilemap (synced), so setting them while the terrain is off is kept for turning it on. The RPG マップ settings gain 「領域の広さ」 (a multiple of the default, 0.5–4) and 「海の割合」. Out-of-range values throw `RangeError` without touching the board; boards keep their recorded params unless a host passes `gen`. The territory cache is now keyed by the generation params too, and keeps only the last few results per map.
