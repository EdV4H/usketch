---
"@edv4h/usketch-plugin-shape-freedraw": minor
---

Emit `freedraw:stroke-committed` (`FREEDRAW_STROKE_COMMITTED`, payload `{ shape }`) on the app's event bus when the user finishes a stroke and it has been added, only on the client that drew it, so a host can follow up on its own strokes (e.g. level the ground under a road drawn with a custom pen).
