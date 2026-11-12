---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-core": minor
"@edv4h/usketch-plugin-tool-select": minor
"@edv4h/usketch-plugin-shape-connector": minor
"@edv4h/usketch-plugin-mode7": patch
---

Plugins can add their own handles to the select tool. `ctx.ui.selectionHandles` (`SelectionHandleProvider`, `app.selectionHandles`) takes a provider that lists handles for the current selection / hover, draws them, and runs a drag when one is pressed. The select tool hit-tests them after its own rotation / resize handles (which always win; a handle sitting on one is not shown), draws them in one layer above the selection frame (`SELECT_TOOL_LAYER_IDS.handles`, order 81), sets their cursor through its own cursor override, passes them its overlay colors, and hides them while it moves, resizes or rotates shapes or draws a marquee. A press on a handle that does nothing selects the handle's shape.

The connector's end handles and anchor dots now use it (`CONNECTOR_HANDLE_IDS`), instead of their own layers. This fixes: a dot drawn on top of a resize handle stealing the press; a click on a hovered shape's edge dot doing nothing; the shape under the pointer showing its dots during an end drag; handles drawn in a fixed blue instead of the selection color; and drag state shared between two boards on one page. The `connector-endpoints` and `connector-anchor-handles` layers are gone (`CONNECTOR_LAYER_IDS.endpoints` / `.anchorHandles` are deprecated); to turn the dots off at runtime, use `app.selectionHandles.unregister(CONNECTOR_HANDLE_IDS.anchors)`. The handles need a select tool from this release.

mode7 tilts the new handles layer with the board.
