---
"@edv4h/usketch-plugin-dashboard": patch
---

Children now move with their parent whenever the dashboard repositions an item (「整列」, enable, column / cell / mode changes, live reflow while dragging, drop snap, and their undo). Previously only the top-level item's `x/y` was written, so a frame's contents stayed behind and a group's children were torn from the group. Which children follow matches the select tool's drag: a container's children, plus any child whose definition opts in via `attachable.follow`.
