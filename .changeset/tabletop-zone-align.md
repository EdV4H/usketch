---
"@edv4h/usketch-plugin-tabletop": minor
---

Zones can lean their layout to the left, the middle or the right: new `align` meta (`start` / `center` / `end`), `setAlign` on the service, `setZoneAlign`, and a **Zone alignment** HUD action. `pile` and `spread` move as a block; `grid` aligns each row on its own. A zone without its own `align` keeps today's layout (`grid` from the left, the others centered) and follows its `arrange` when that changes (`storedZoneMeta` is what `updateZoneMeta` writes back). `arrangeBy` takes the alignment as an optional fifth argument.
