---
"@edv4h/usketch-plugin-map": minor
---

feat(map)!: world-layer icons are now GRID DATA on the tilemap, not free shapes (#955)

Placed map icons and base beacons are unified into the tilemap's cell-grid model
(the same island pattern as terrain), so the generic Select tool can't touch the
world layer — there are no shapes to grab — while the Map tool edits it directly.

- Icons live on `TileMapShapeData.icons` (`cellKey → iconKey`, one per cell). The
  Map tool's **stamp** writes a cell and **eraser** removes it (icons take priority
  over terrain). They render via the new `MapIconGridLayer` (order 44: above
  terrain/base, below host resource shapes). Persist / sync / undo for free.
- Base beacons are now **cells**: `BaseInfo.beaconCell` (`cellKey`) replaces
  `beaconIconId`. Base mode sets the beacon at the clicked cell; territory + the
  radius ring derive from the cell centre.

**BREAKING** (clean break — no data migration; pre-1.0):

- The `map-icon` shape type is **removed**: `MAP_ICON_TYPE`, `MapIconShapeData`,
  `makeMapIcon`, and the shape definition no longer exist / are no longer exported.
  Old boards' free `map-icon` shapes are ignored (not rendered). Hosts wanting
  freely-movable markers should use their own shape type.
- `BaseInfo.beaconIconId` and `MapIconShapeData.meta.baseId` are gone; existing
  bases without a `beaconCell` have no territory until a beacon is re-placed.
- New: `renderIconAt(iconKey, col, row, tile)` exported for drawing a grid icon.
