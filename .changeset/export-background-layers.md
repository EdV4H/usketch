---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-export": minor
"@edv4h/usketch-plugin-bg-grid": minor
"@edv4h/usketch-plugin-bg-dots": minor
---

`exportRegion` / `buildRegionSvg` can now include background layers (grid / dots) in the export (#1117).

- `@edv4h/usketch-shared`: `Layer.renderExportBackground(ctx)` (optional). It returns board-coordinate SVG for a region export, or `null` while the background is hidden. New type: `LayerExportBackgroundContext` (`rect`, `zoom`, `idPrefix`).
- `@edv4h/usketch-plugin-export`: new `ExportRegionOptions` fields:
  - `includeBackgroundLayers` (default `false`; when false the output is unchanged).
  - `layers` (pass `app.layers`; required when `includeBackgroundLayers` is true).
  - `backgroundZoom` (default `1` = draw as at 100%; pass the capture-time `viewport.zoom` to match the screen).
  - Background layers are drawn in ascending `order`, above `background` and below the shapes.
- `@edv4h/usketch-plugin-bg-grid` / `@edv4h/usketch-plugin-bg-dots`: implement `renderExportBackground`. They also export `renderGridExportBackground` / `renderDotsExportBackground`. Grid spacing and dot positions stay fixed in board units; only the grid line width (1 screen px = `1 / zoom` board units) depends on `backgroundZoom`.
