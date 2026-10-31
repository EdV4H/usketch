---
"@edv4h/usketch-plugin-character": patch
---

The camera anchor no longer measures the canvas every frame: its size is cached and refreshed on window resize or after 500 ms.
