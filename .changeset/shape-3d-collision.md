---
"@edv4h/usketch-plugin-shape-3d": minor
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-character": minor
---

3D shapes can now collide with the character. A shape's `x-shape-3d` takes `collision`: `"none"` (default), `"solid"` (a wall) or `"platform"` (a box's top that can be stepped or jumped onto); a stood-up shape blocks along its bottom edge (fixed facing) or at a small disc at its foot (camera facing), a floating one never collides. The shape-3d plugin answers the new shared `solidHeightService` from a grid index of all shapes, and the character combines it with the ground height: walls block (sliding along them), tops are stood on, and moves are checked in short stretches (`sweepToGround`) so a fast move can't skip a thin wall. Collision applies in 2D too unless the new `collisionIn3dOnly` limit is set. Both settings are in the HUD.
