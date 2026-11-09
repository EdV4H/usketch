---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-elevation": minor
"@edv4h/usketch-plugin-character": minor
---

Raise the 3D view's camera with the ground. Mode 7's `Camera` gets `height` (world units, default 0; `setHeight`): everything is drawn that much lower, so ground at that height shows where the flat board would. Hold Space / Shift in the 3D view to move the camera up / down (`heightKeys`, `heightSpeed`, rebindable via `setHeightKeys`). In shared, `View3dCamera.heightPx` and the optional `View3dApi.setCameraHeight` carry it; `getRenderedCamera().heightPx`, `projectToGround` / `unprojectFromGround` (now with a `z`) and the elevation mesh honor it. The character's follow camera sets it to the ground under the feet (eased), so walking up a high mountain no longer leaves the view.
