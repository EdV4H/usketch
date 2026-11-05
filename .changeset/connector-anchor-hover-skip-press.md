---
"@edv4h/usketch-plugin-shape-connector": patch
---

The anchor-handle hover no longer hit-tests every shape on each pointer move while the pointer is held down (shape drag, marquee, resize), since the handles are hidden then; the hover is resolved once at pointerup instead. No visible change.
