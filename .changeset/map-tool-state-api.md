---
"@edv4h/usketch-plugin-map": minor
---

map: ツール状態の公開 reactive store を export（#927）— ホスト独自 UI から mode/terrain/icon を駆動可能に

Control HUD（`debug-hud`）以外の UI（ActionRing / ラジアルメニュー / 独自ツールバー等）から
マップツールの状態を切り替えられるよう、内部の app-local reactive store を公開した。
`renderConfigStore` と同じ「public reactive store（get/set/subscribe）」パターンで一貫。

追加 export（`@edv4h/usketch-plugin-map`）:

- `toolStateStore` ＋ `type MapToolState` ＋ `useMapToolState()` — mode / terrain / iconKey / excludeTerrains
- `MAP_MODES`（`brush|eraser|fill|region|stamp|generate|base` の順序付き配列。`MapMode` はこれから派生）
- `rangeEraseStore` ＋ `type RangeEraseTargets` ＋ `useRangeEraseTargets()`
- `genStateStore` ＋ `type GenState` / `type WorldRect` ＋ `useGenState()`
- `baseStateStore` ＋ `type BaseToolState` ＋ `useBaseState()`
- `type ReactiveStore`（各 store の共通インターフェース）

既に export 済みの `TERRAINS` / `ICONS` / `MAP_MODES` と組み合わせて、ホストが Control HUD に
依存しないツール切替 UI を実装できる。いずれも同期対象外（presentation/interaction state）。
