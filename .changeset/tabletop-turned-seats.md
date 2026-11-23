---
"@edv4h/usketch-plugin-tabletop": minor
"@edv4h/usketch-store": minor
"@edv4h/usketch-shared": minor
---

Turned zones and player views. A zone turned on the board (a hand across the table) now lays out along its own edges, and its children turn with it so they read the right way up for the player sitting there (every arrangement but `free`; an unturned zone still leaves a child's own turn alone). A turned player view turns the camera the other way, so the seat across the table sees its view upright: `fitViewToScreen`, the `fixed` / `zoom` holds and `isAtView` take the view's turn, the hold keeps it (the camera still can't be turned by hand), and the move to the view swings about the screen's centre. **Add player view** on a turned camera makes a view turned the same way. New in tabletop: `ViewRect` (a box plus `rotation`), `viewRectOf(shape)`, `viewCameraRotation(rect)`, `screenViewRect(viewport, size)` and `rotation` on `createViewShape`. New in store / shared: `animateViewportTo(target, { pivot })` keeps the world point under a screen point moving straight, so a move that also turns the camera doesn't sweep the board off screen.
