---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": patch
"@edv4h/usketch-shape-utils": patch
"@edv4h/usketch-plugin-shape-text": patch
---

Rotated shapes no longer slide when their size changes. A single-shape resize of a rotated shape keeps the edge or corner opposite the handle where it is on screen, also across a flip (it used to drift, and a flip jumped sideways). Editable text shapes (sticky notes etc.) that grow while typing keep their top-left corner in place when rotated. The rotation zone at a selection's corners now starts only outside the shape, so grabbing a shape just inside a corner moves it instead of rotating it. New in `@edv4h/usketch-shared`: `placeLocalBox(local, pivot, angleDeg)` and `keepRotatedTopLeft(shape, width, height)`.
