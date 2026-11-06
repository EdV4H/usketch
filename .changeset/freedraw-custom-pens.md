---
"@edv4h/usketch-plugin-shape-freedraw": minor
---

Other plugins and hosts can now add their own pens next to the four built-in ones. Pass them as `createFreedrawPlugin(config, { pens })`; the registration is reference-counted, so several boards in one runtime can share a pen. A pen supplies its own SVG `render` (and an optional `renderDraft` while drawing), an optional `finalize` that rewrites the points once on pointer-up and can store `penData` on the shape, its size range, its half width for bounds / hit-testing / the eraser, and whether it uses the colour. Its strokes stay `freedraw` shapes, so select / move / resize / erase / undo / sync work unchanged; a client without the pen draws them as ballpoint lines. `listPens()` (also on `getFreedrawApi(app.services)`) lists the built-in and added pens for a pen picker, `freedraw:set-pen` / the `freedraw:pen` action accept the added ids, and `freedraw:set-size` clamps to an added pen's size range.
