---
"@edv4h/usketch-plugin-tabletop": minor
---

Player views: a new `tabletop-view` shape marks what a player sees while a game is played (`label`, `camera`: `fixed` / `zoom` / `free`, default `zoom`). Only its edge and label strip take clicks. `applyViewCamera(store, getRect, camera, { getSize })` brings the camera to a view and holds it with the store's viewport constraint (returns `release` / `returnToView`); the pieces (`fitViewToScreen`, `stayInViewConstraint`, `pinToViewConstraint`, `isAtView`, `visibleWorldRect`) are exported. Views come with `createViewShape`, `readViewMeta`, `listViews`, `setViewLabel` / `setViewCamera`, service methods (`addView`, `setViewLabel`, `setViewCamera`, `views`), HUD actions (**Add player view**, **View camera**, **View label**) and the `views` / `renderView` plugin options.
