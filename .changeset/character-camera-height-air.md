---
"@edv4h/usketch-plugin-character": patch
---

The follow camera's height now accounts for jumps and hovers. In the air it holds the take-off height (a jump still rises on screen, and a pit or valley under the jump no longer dips the view), rises once a hover climbs higher than a jump (`jump.height`) above it, and comes down with a fall below it. On the ground it follows the ground as before. The math is exported as `followCameraHeight`.
