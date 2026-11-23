---
"@edv4h/usketch-plugin-tabletop": minor
---

Turned zones and player views. A zone turned on the board (a hand across the table) now lays out along its own edges, and its children turn with it so they read the right way up for the player sitting there; every arrangement but `free` keeps a child facing the zone's way. A turned player view turns the camera the other way, so the seat across the table sees its view upright: `fitViewToScreen`, the `fixed` / `zoom` holds and `isAtView` take the view's turn, and the hold keeps it (the camera still can't be turned by hand). New: `ViewRect` (a box plus `rotation`), `viewRectOf(shape)` to build one from a view shape, and `viewCameraRotation(rect)`.
