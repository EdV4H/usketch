# @edv4h/usketch-plugin-tabletop

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
