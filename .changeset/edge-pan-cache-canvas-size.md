---
"@edv4h/usketch-plugin-edge-pan": patch
---

While a shape is being dragged, edge-pan no longer looks up the canvas element and reads its size (`querySelectorAll` + `getBoundingClientRect`) on every animation frame; the size is measured once per drag and re-measured on window resize. No visible change.
