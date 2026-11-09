---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-mode7": minor
"@edv4h/usketch-plugin-elevation": minor
"@edv4h/usketch-plugin-character": minor
---

Raise the 3D view's eye with the ground. Mode 7 gets an eye height (`setEyeHeight` / `getEyeHeight`, world units): everything is drawn that much lower, so ground at that height shows where the flat board would. `View3dCamera.lift` (px) and the optional `View3dApi.setEyeHeight` carry it in shared; `projectToGround` / `unprojectFromGround` (now with a `z`) and the elevation mesh honor it. The character's follow camera sets it to the ground under the feet (eased), so walking up a high mountain no longer leaves the view.
