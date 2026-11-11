---
"@edv4h/usketch-plugin-character": minor
---

On the flat (2D) board a jump now lifts the character up the screen and grows it a little while its shadow stays at the feet (`motion.flatLift`, HUD "ジャンプで画面上に浮かせる（2D）"). The look fades out as the view turns 3D, where the body rises for real. Renderers get a new `depth` prop (0 = flat … 1 = 3D).
