---
"@edv4h/usketch-plugin-shape-3d": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-dom-renderer": minor
"@edv4h/usketch-plugin-mode7": minor
---

Shapes can now stand up out of the ground in Mode 7. The new `@edv4h/usketch-plugin-shape-3d` draws shapes holding `x-shape-3d` parameters (`mode: "stand"`, facing the camera or along their bottom edge, on the terrain, with a shadow) folded up in pure CSS 3D while the 3D view is on, and rising / settling with its transition; the flat board, export and editing are unchanged. Set it from the HUD group "3D（選択中の Shape）" or `getShape3dApi(app.services)`.

Supporting pieces: shared gains `view3dService` (how 3D the board is shown, plus the drawn camera), which Mode 7 now provides; Mode 7 tilts the `shape-3d` layer with depth by default; the DOM renderer exports `ShapeContent` and skips shapes named by the `renderer:hide-shapes` event.
