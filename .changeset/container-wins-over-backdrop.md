---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-tool-helpers": minor
"@edv4h/usketch-plugin-tabletop": patch
---

Let a container be clicked when it is laid on a picture.

- `container.winsOverBackdrop` (default `false`): a container with selectable children (a frame) is picked only where no other shape is hit, so a card slot laid on a board picture could never be clicked. With `true`, a click on the container picks it over its backdrop: a shape drawn behind it whose bounds wholly enclose it. Other shapes (a card lying partly under it, a shape drawn on top) still win as before. `containerWinsOverBackdrop(def, shape)` reads it.
- Tabletop zones set `winsOverBackdrop: true`, so a zone laid on a board picture can be clicked and selected.
