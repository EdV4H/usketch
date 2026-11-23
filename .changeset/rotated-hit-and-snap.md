---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-store": patch
"@edv4h/usketch-tool-helpers": patch
"@edv4h/usketch-plugin-community-chat": patch
"@edv4h/usketch-plugin-croupier": patch
"@edv4h/usketch-plugin-presentation": patch
"@edv4h/usketch-plugin-shape-board-portal": patch
"@edv4h/usketch-plugin-shape-community-region": patch
"@edv4h/usketch-plugin-shape-counter": patch
"@edv4h/usketch-plugin-shape-frame": patch
"@edv4h/usketch-plugin-shape-freedraw": patch
"@edv4h/usketch-plugin-shape-sticky": patch
"@edv4h/usketch-plugin-shape-text": patch
"@edv4h/usketch-plugin-snap": patch
"@edv4h/usketch-plugin-timter": patch
"@edv4h/usketch-plugin-tool-select": patch
"@edv4h/usketch-plugin-voice-notes": patch
---

Rotated shapes are now hit, selected, snapped and dropped into where they are drawn. Snapping compares the bounds of each rotated shape's turned outline (moving and target), never snaps a rotation, and skips the resize of a rotated shape. The marquee tests a rotated shape's drawn outline (contain: all corners; intersect: separating-axis). Auto-attach (frames, attachable stickers) and the drop-target highlight treat a rotated container as its turned box, and the highlight is drawn rotated. The frame, counter, timer, board portal, community region, croupier table/seat, voice notes, open slide, community chat and freedraw shapes now hit-test with `withRotation`, and sticky/text start editing on a double-click anywhere on a rotated note. New in `@edv4h/usketch-shared`: `getShapeCorners`, `getShapeWorldAABB`, `rectIntersectsShape`, `shapeBoxContainsPoint`.
