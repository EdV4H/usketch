---
"@edv4h/usketch-plugin-shape-connector": patch
---

Dragging a connector end now lands where the pointer is when the canvas does not start at the page's top-left (e.g. a side panel pushes it right). The drag read `window` client coordinates as canvas coordinates; it now reads the canvas `canvas:pointermove` / `canvas:pointerup` events, so it also follows a zoom made mid-drag. A release off the canvas ends at the last point the canvas reported. The anchor handles of the shape under the pointer are no longer shown during an endpoint drag, since the drop never snaps to them.
