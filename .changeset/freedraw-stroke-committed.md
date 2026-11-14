---
"@edv4h/usketch-plugin-shape-freedraw": minor
---

Custom pens can define `onCommit(shape, { store, commands })`: called once on the drawing client right after a finished stroke is added (never for strokes synced from peers). Whatever it runs through `ctx.commands` joins the stroke's undo / redo step, so e.g. levelling the ground under a road undoes together with the road. Errors it throws are logged and the stroke stays. The `PenCommitContext` type is exported.
