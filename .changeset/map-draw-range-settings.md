---
"@edv4h/usketch-plugin-map": minor
---

The map's draw range and level of detail can now be adjusted (defaults unchanged): how far past the screen the ground is drawn in a 3D view (`groundOverscanMaxPx`), whether the cliffs also cover that ground (`reliefOverscan`), how many cells along the ground's edge stay flat (`reliefEdgeInset`), and the on-screen tile size for full detail (`fullDetailMinPx`). Set them from the Control HUD "RPG マップ" settings, `createMapPlugin({ detail })`, or `getMapApi(services).renderConfig`. `tileDetail` takes the threshold as an optional third argument, and `reliefCellRange` / `clampGroundOverscan` / `detailConfigPatch` are exported.
