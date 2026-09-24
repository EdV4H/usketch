---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-canvas-engine": minor
"@edv4h/usketch-tool-helpers": patch
"@edv4h/usketch-plugin-bg-grid": minor
"@edv4h/usketch-plugin-snap": patch
"@edv4h/usketch-plugin-presence-activity": patch
"@edv4h/usketch-plugin-tool-vim": patch
"@edv4h/usketch-plugin-shape-freedraw": patch
"@edv4h/usketch-plugin-shape-connector": patch
"@edv4h/usketch-plugin-sync-ywebsocket": patch
"@edv4h/usketch-plugin-comments": patch
"@edv4h/usketch-plugin-shape-frame": patch
---

Keep overlays aligned under camera rotation.

- shared / canvas-engine: new `Layer.worldOverlay` for fixed layers that draw
  world-anchored things in screen px. Under rotation the canvas turns such a layer
  with the world (about the world origin on screen) and renders it with an
  unrotated viewport, so existing `zoom·w + (x, y)` math stays correct unchanged.
  Helpers: `unrotatedViewport`, `screenToOverlay`, `overlayFrameStyle`. The
  selection foreground is a world overlay by default
  (`SelectionForeground.worldOverlay`).
- tool-helpers: resize/rotation handle hit tests compare in the same overlay frame,
  so handles can be grabbed where they're drawn.
- bg-grid: the grid turns with the camera (a diagonal-sized square rotated about
  the screen center, phased onto world multiples).
- snap, presence-activity, tool-vim, shape-freedraw, shape-connector,
  sync-ywebsocket, comments, shape-frame: their board-anchored overlays opt into
  `worldOverlay`; snap's visible-candidate area is rotation-aware.
