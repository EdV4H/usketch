---
"@edv4h/usketch-plugin-character": minor
---

The follow camera's height now also follows the body once it is more than `cameraHeightMargin` (world units, default = the jump's height) above the ground under it, so a long hover, a high multi-jump or a fall from a cliff stays in view while an ordinary jump doesn't bob the view. `0` follows the body exactly; `getCameraHeightMargin` / `setCameraHeightMargin` change it at runtime.
