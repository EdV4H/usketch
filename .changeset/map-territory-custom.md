---
"@edv4h/usketch-plugin-map": minor
---

feat(map): customizable territory (領域) overlay + host-facing territory readout

Two host-integration points for the base "territory" feature:

- **Custom UI** — `createMapPlugin({ territory })` now takes a `TerritoryStyle`:
  `fillOpacity`, `border` (ratio/opacity), `ring` (enabled/strokeWidth/dash/opacity),
  `label` (enabled + a `render(anchor)` override for the name chip), and
  `show: "base-mode" | "always"` (default `"base-mode"` — only while editing bases;
  `"always"` surfaces areas to end users). Merges over the defaults, so omitting it
  keeps the stock look.
- **External readout** — the map service (`getMapApi(app.services)`) gains
  `getTerritory()` (`cellKey → baseId`), `getBaseAt(x, y)`, `getBases()`,
  `getBaseRegions()` (per-base centre / colour / cell count), and
  `onTerritoryChange(cb)`, so a host can drive its own minimap / area labels /
  "you are in X" without importing internals.

Also exports `baseIdAtWorld`, `baseRegionAnchors`, `getBaseMap`, `BaseRegionAnchor`,
and the `TerritoryStyle` / `resolveTerritoryStyle` / `DEFAULT_TERRITORY_STYLE` types.
