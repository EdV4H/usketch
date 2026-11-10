---
"@edv4h/usketch-shared": minor
---

Add ground decals: a board-wide registry of things painted ONTO the ground surface (a course, a road, a marking). `groundDecals(services)` returns the registry, providing it on first use so painters and renderers can come in any order (`groundDecalService` is the handle). A decal is `{ paint(ctx, { rect, pxPerUnit, view }), bounds?(), views?: ("flat" | "3d")[], order? }`, painted in world units. `set` / `remove` / `invalidate(id, rect?)` record what changed, and renderers repaint only the tiles a change touches (`changedSince(version, view, rect)`).
