---
"@edv4h/usketch-plugin-character": minor
---

`setVirtualInput` gains a `jump` button: held, it acts like the jump key (a release while rising cuts the jump short, holding it in a fall hovers, air jumps on each press), so a touch control can jump and hover too. Presses of the virtual jump and drift buttons are latched until the next frame, so a quick tap between frames still jumps (or starts a drift hop). `virtualPresses(prev, next)` is exported for hosts that need the same edges.
