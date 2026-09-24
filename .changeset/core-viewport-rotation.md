---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-store": minor
---

Camera rotation in the Core viewport. `Viewport` gains an optional `rotation`
(degrees, clockwise-positive) applied about the screen origin:
`screen = R(rotation) · (zoom · world) + (x, y)`. When it is unset or `0` every
transform reduces exactly to the previous translate+scale, so existing viewports,
plugins and CSS output are unchanged.

- shared: rotation-aware `worldToScreen` / `screenToWorld`, plus
  `viewportAnchoredAt`, `screenRectToWorldBounds`, `viewportTransformStyle`,
  `viewportRotation`, `wrapDeg` and `shortestAngleDelta`. `centerOnWorld` /
  `zoomToLevel` / `screenCenterWorld` keep the current rotation.
- canvas-engine: layers render through the rotation-aware transform, and
  `viewportBounds` becomes the world AABB of the (possibly rotated) screen.
- store: new `rotateTo(deg, center, opts?)` (keeps the world point under `center`
  fixed, instant by default); `zoomTo` / `fitToBounds` preserve the rotation;
  `animateViewportTo` turns the short way round; a zero rotation is normalized
  away. `clampViewportToBounds` passes rotated viewports through unchanged.

Note: overlays that hand-roll `(p - vp.x) / zoom` math are still unrotated, so
they are only correct while `rotation` is `0`.
