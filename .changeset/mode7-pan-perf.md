---
"@edv4h/usketch-plugin-mode7": patch
---

Mode 7 no longer re-applies the tilt on every pan: the stylesheet is rebuilt only when the zoom, window size, camera or tilted layers change, and an unchanged stylesheet is not rewritten. Walking a character (the camera follows it every frame) no longer restyles the whole stage each frame.
