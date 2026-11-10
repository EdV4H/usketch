---
"@edv4h/usketch-plugin-elevation": minor
---

Paint ground decals (shared's `groundDecals`) onto the terrain. Under a 3D view the mesh maps them onto the raised surface as a texture per tile, so a course follows every slope, is shaded like the ground and hides behind hills. The flat ground lays a decal canvas over each tile. Texture size follows how big the tile shows on screen (64 to 1024 px, mipmapped), only tiles with decals get one, and repaints are budgeted per frame. The helpers `decalTilePx`, `projectedTilePx`, `paintDecalTile`, `decalTexMapping` and `tileWorldRect` are exported.
