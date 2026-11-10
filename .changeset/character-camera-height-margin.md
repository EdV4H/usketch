---
"@edv4h/usketch-plugin-character": minor
---

The follow camera's height now accounts for jumps and hovers. In the air it holds the take-off height, so an ordinary jump still rises on screen and running off a ledge over a pit doesn't dip the view; a hover or a high multi-jump that climbs more than `cameraHeightMargin` (world units, default = the jump's height) above it drags the camera up, and a fall below it takes the camera down. `0` follows the body exactly; `getCameraHeightMargin` / `setCameraHeightMargin` change it at runtime.
