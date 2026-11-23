# @edv4h/usketch-plugin-tabletop

## 0.4.0

### Minor Changes

- ba2c89c: Turned zones and player views. A zone turned on the board (a hand across the table) now lays out along its own edges, and its children turn with it so they read the right way up for the player sitting there (every arrangement but `free`; an unturned zone still leaves a child's own turn alone). A turned player view turns the camera the other way, so the seat across the table sees its view upright: `fitViewToScreen`, the `fixed` / `zoom` holds and `isAtView` take the view's turn, the hold keeps it (the camera still can't be turned by hand), and the move to the view swings about the screen's centre. **Add player view** on a turned camera makes a view turned the same way. New in tabletop: `ViewRect` (a box plus `rotation`), `viewRectOf(shape)`, `viewCameraRotation(rect)`, `screenViewRect(viewport, size)` and `rotation` on `createViewShape`. New in store / shared: `animateViewportTo(target, { pivot })` keeps the world point under a screen point moving straight, so a move that also turns the camera doesn't sweep the board off screen.

### Patch Changes

- Updated dependencies [5dc7d1b]
- Updated dependencies [8d13a3a]
- Updated dependencies [9aa4ddb]
- Updated dependencies [ba2c89c]
  - @edv4h/usketch-shared@4.31.0
  - @edv4h/usketch-store@3.14.0
  - @edv4h/usketch-shape-utils@2.4.12

## 0.3.0

### Minor Changes

- 8cb08f0: Player views: a new `tabletop-view` shape marks what a player sees while a game is played (`label`, `camera`: `fixed` / `zoom` / `free`, default `zoom`). Only its edge and label strip take clicks. `applyViewCamera(store, getRect, camera, { getSize })` brings the camera to a view and holds it with the store's viewport constraint (returns `release` / `returnToView`); the pieces (`fitViewToScreen`, `stayInViewConstraint`, `pinToViewConstraint`, `isAtView`, `visibleWorldRect`) are exported. Views come with `createViewShape`, `readViewMeta`, `listViews`, `setViewLabel` / `setViewCamera`, service methods (`addView`, `setViewLabel`, `setViewCamera`, `views`), HUD actions (**Add player view**, **View camera**, **View label**) and the `views` / `renderView` plugin options.

## 0.2.0

### Minor Changes

- cff264e: Zones can lean their layout to the left, the middle or the right: new `align` meta (`start` / `center` / `end`), `setAlign` on the service, `setZoneAlign`, and a **Zone alignment** HUD action. `pile` and `spread` move as a block; `grid` aligns each row on its own. A zone without its own `align` keeps today's layout (`grid` from the left, the others centered) and follows its `arrange` when that changes (`storedZoneMeta` is what `updateZoneMeta` writes back). `arrangeBy` takes the alignment as an optional fifth argument.

### Patch Changes

- Updated dependencies [3566290]
  - @edv4h/usketch-shared@4.30.0
  - @edv4h/usketch-store@3.13.2
  - @edv4h/usketch-shape-utils@2.4.11

## 0.1.1

### Patch Changes

- Updated dependencies [66e8499]
  - @edv4h/usketch-shared@4.29.0
  - @edv4h/usketch-store@3.13.1
  - @edv4h/usketch-shape-utils@2.4.10

## 0.1.0

### Minor Changes

- f5366ad: New plugin `@edv4h/usketch-plugin-tabletop` with zones (`tabletop-zone`): places on the board that hold cards or pieces and lay out what is dropped in them (pile, spread, grid or free), optionally turning it up or down. `@edv4h/usketch-plugin-shape-card` adds `cardTurnFace`, which turns a card or deck up or down for a zone.

### Patch Changes

- Updated dependencies [3d0a677]
  - @edv4h/usketch-shared@4.28.0
  - @edv4h/usketch-store@3.13.0
  - @edv4h/usketch-shape-utils@2.4.9
