---
"@edv4h/usketch-plugin-elevation": patch
---

`tileRevision` is remembered per elevation model (models are replaced, never mutated, when the heights change), so the 3D mesh layer no longer rebuilds every visible tile's revision key on every frame of a 3D view, and the flat ground layer no longer does it on every re-render while the camera moves. Zoomed out over a brushed terrain this was up to ~1.4 ms per frame. What is drawn is unchanged.
