---
"@edv4h/usketch-plugin-map": minor
---

feat(map): structural ("world layer") map-icons — Select-protected, Map-editable (#955)

A map-icon can now be marked **structural**: the generic Select tool can't touch it
(not selectable / movable / deletable), but the Map tool can still place / erase /
beacon it. This gives hosts a clean 3-state model for the "World" layer separation:

- normal (`locked:false`) → Select ✓ / Map ✓
- structural → Select ✗ / Map ✓
- frozen (`locked:true`, non-structural) → Select ✗ / Map ✗

Structural icons piggyback on `locked:true` (which is what keeps the generic Select
tool off them via the existing `isEffectivelyLocked` gate), while the Map tool now
ignores the lock for structural icons. Drive it from a host without the Control HUD:

- `mapService` / `getMapApi(app.services)`: `setIconStructural(id, boolean)`,
  `isIconStructural(id)`.
- Direct exports: `setIconStructural`, `isIconStructural`, `isStructuralIcon`,
  `isMapIconEditable`, and `MapIconShapeData.meta.structural?: boolean`.
