---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-plugin-tabletop": patch
---

Let a container stop giving way to the shapes behind it.

- `container.yieldToShapes` (default `true`): a container with selectable children (a frame) is picked only where no other shape is hit, even one drawn behind it. Set it to `false` and the container hides what is behind it: the shape drawn on top wins, and the container's own contents can still be clicked even when they are drawn behind it. `containerYieldsToShapes(def, shape)` reads it.
- Tabletop zones set `yieldToShapes: false`, so a zone laid over a board picture can be clicked and selected.
