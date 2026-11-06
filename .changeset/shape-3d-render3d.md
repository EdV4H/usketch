---
"@edv4h/usketch-plugin-shape-3d": minor
---

A shape type can now draw its own 3D look: `render3d` in its type config replaces the generic stand / box / float drawing (return `null` to keep the generic one for a shape). The layer places a node of the shape's size at its anchor, lifted to the terrain and turned to the shape's heading, and passes a `Shape3dRenderContext` (transition amount, zoom, node size, the turn that faces the camera, the shape's own drawing, and the live camera with change notifications for canvases such as three.js). Ships `crossRender3d`, which draws a stood-up shape as two crossed planes (a tree / plant sprite). The web community page now stands board portals in Mode 7 by default.
