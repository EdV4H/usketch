---
"@edv4h/usketch-plugin-avatar": patch
"@edv4h/usketch-plugin-board-info-panel": patch
"@edv4h/usketch-plugin-shape-card": patch
---

Find the screen centre with the shared `screenCenterWorld` helper instead of hand-rolled `window.innerWidth / 2` maths, so it is right when the viewport is rotated: the avatar's shared `viewportCenter` (also re-sent when only the rotation changes), the board portal added from the board info panel, and a card played from the hand.
