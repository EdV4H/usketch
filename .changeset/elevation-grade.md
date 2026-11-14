---
"@edv4h/usketch-plugin-elevation": minor
---

Add `gradeElevation(deps, path, opts)` (also `getElevationApi().grade`) to level a strip of ground along a path in one undo step, e.g. under a road or race track drawn over hills: flat across `halfWidth`, following the ground under the path averaged over `smoothing` (or at one `height`) along it, and blending into the terrain over a `shoulder`. `closed` wraps the averaging around a loop. Does nothing on a board without an elevation field. Also exports the pure pieces (`applyGrade`, `gradeProfile`, `resamplePath`) and `strokeEditor`, the grid read/write access the brush now uses.
