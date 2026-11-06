# @edv4h/usketch-plugin-shape-3d

## 0.2.0

### Minor Changes

- 5c1dfe8: 3D shapes can now also be a `box` (the shape lifted as the top of a block, with four walls folded down to the ground in a darker shade of its fill) or `float` (the shape lifted flat into the air with a shadow below), both rising to `height` (world units; defaults 16 / 24) with the Mode 7 transition. `box` is offered for rectangle, rounded-rect, sticky, card, frame and image; other types get stand / float unless the host's `types` says otherwise. The HUD gains the new modes and a height field.
  
  The layout helpers are renamed for all modes: `shapePose` / `ShapePose`, `poseBox`, `poseTransform`, `poseOrigin`, plus `shapeAnchor`, `boxWalls`, `boxTopTransform`, `wallColor` and `wallShade`.
- abc7f44: 3D shapes can now collide with the character. A shape's `x-shape-3d` takes `collision`: `"none"` (default), `"solid"` (a wall) or `"platform"` (a box's top that can be stepped or jumped onto); a stood-up shape blocks along its bottom edge (fixed facing) or at a small disc at its foot (camera facing), a floating one never collides. The shape-3d plugin answers the new shared `solidHeightService` from a grid index of all shapes, and the character combines it with the ground height: walls block (sliding along them), tops are stood on, and moves are checked in short stretches (`sweepToGround`) so a fast move can't skip a thin wall. Collision applies in 2D too unless the new `collisionIn3dOnly` limit is set. Both settings are in the HUD.
- 8c2d0e7: A shape type can now draw its own 3D look: `render3d` in its type config replaces the generic stand / box / float drawing (return `null` to keep the generic one for a shape). The layer places a node of the shape's size at its anchor, lifted to the terrain and turned to the shape's heading, and passes a `Shape3dRenderContext` (transition amount, zoom, node size, the turn that faces the camera, the shape's own drawing, and the live camera with change notifications for canvases such as three.js). Ships `crossRender3d`, which draws a stood-up shape as two crossed planes (a tree / plant sprite). The web community page now stands board portals in Mode 7 by default.

### Patch Changes

- Updated dependencies [abc7f44]
  - @edv4h/usketch-shared@4.21.0
  - @edv4h/usketch-dom-renderer@2.3.1

## 0.1.0

### Minor Changes

- df6edda: Shapes can now stand up out of the ground in Mode 7. The new `@edv4h/usketch-plugin-shape-3d` draws shapes holding `x-shape-3d` parameters (`mode: "stand"`, facing the camera or along their bottom edge, on the terrain, with a shadow) folded up in pure CSS 3D while the 3D view is on, and rising / settling with its transition; the flat board, export and editing are unchanged. Set it from the HUD group "3D（選択中の Shape）" or `getShape3dApi(app.services)`.
  
  Supporting pieces: shared gains `view3dService` (how 3D the board is shown, plus the drawn camera), which Mode 7 now provides; Mode 7 tilts the `shape-3d` layer with depth by default; the DOM renderer exports `ShapeContent` and skips shapes named by the `renderer:hide-shapes` event.

### Patch Changes

- Updated dependencies [df6edda]
  - @edv4h/usketch-shared@4.20.0
  - @edv4h/usketch-dom-renderer@2.3.0
