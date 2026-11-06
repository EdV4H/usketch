---
"@edv4h/usketch-plugin-shape-3d": minor
---

3D shapes can now also be a `box` (the shape lifted as the top of a block, with four walls folded down to the ground in a darker shade of its fill) or `float` (the shape lifted flat into the air with a shadow below), both rising to `height` (world units; defaults 16 / 24) with the Mode 7 transition. `box` is offered for rectangle, rounded-rect, sticky, card, frame and image; other types get stand / float unless the host's `types` says otherwise. The HUD gains the new modes and a height field.

The layout helpers are renamed for all modes: `shapePose` / `ShapePose`, `poseBox`, `poseTransform`, `poseOrigin`, plus `shapeAnchor`, `boxWalls`, `boxTopTransform`, `wallColor` and `wallShade`.
