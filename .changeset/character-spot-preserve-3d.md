---
"@edv4h/usketch-plugin-character": patch
---

The character spots keep the 3D context down to the renderer's content (`transform-style: preserve-3d`), so under a 3D view (Mode 7) a renderer can stand its sprite up out of the ground (e.g. `rotateX(-pitch)` with the pitch from `view3dService`) instead of having it flattened onto the ground. The flat board looks the same.
