---
"@edv4h/usketch-plugin-container": patch
---

A child dragged out of a container with a `layout` (for example a card taken off a tabletop pile) now leaves it. The re-layout after a drop waited only for pointer up, so it ran before the drop's reparent and pulled the child back in. It now waits for the move to commit and the reparent after `shapes:move-end`.
