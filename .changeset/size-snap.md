---
"@edv4h/usketch-plugin-snap": minor
---

Snap sizes while resizing a single shape (and while drawing a new one).

- **Square**: when width and height come within the snap threshold of each other, they snap to equal. A dashed diagonal through the dragged corner shows it. Rotated shapes square up too (along their own axes).
- **Same size as another shape**: the dragged side snaps to the width / height of a nearby (visible, unrotated) shape. A bar above (width) or left of (height) the shape and every shape of that size shows it.
- An edge alignment still wins on its axis; the other side may then square up to it.
- Aspect-locked shapes (an image keeping its ratio) and multi-selection resizes are never size-snapped. Ctrl / Cmd suppresses it like the other snaps.
- Each has its own switch, default on: HUD actions "Square snap" (`snap:toggle-square`) and "Same-size snap" (`snap:toggle-same-size`), options / settings `squareSnap` and `sameSizeSnap` (`snap:configure`). New `SizeGuide` type.
