---
"@edv4h/usketch-shape-utils": major
"@edv4h/usketch-plugin-shape-basic": patch
---

Move `rectGpuPrimitive` / `roundedRectGpuPrimitive` / `ellipseGpuPrimitive` / `lineGpuPrimitive` from `@edv4h/usketch-shape-utils` to `@edv4h/usketch-plugin-shape-basic`.

These helpers were the only callers of the `cornerRadius` field and were used exclusively by `shape-basic` (no other plugin depended on them). Keeping them in the generic `shape-utils` package leaked plugin-specific knowledge and required an unsafe `(data as { cornerRadius?: number }).cornerRadius` cast inside the otherwise plugin-agnostic utility. Moving them lets `rectGpuPrimitive` accept the typed `RectangleShapeData` directly, eliminating the cast.

This also aligns the codebase with `shape-freedraw`, which already keeps its own `gpuPrimitive` implementation inside the plugin.

If you imported these from `@edv4h/usketch-shape-utils`, switch to `@edv4h/usketch-plugin-shape-basic` (or move equivalent logic into your own plugin).
