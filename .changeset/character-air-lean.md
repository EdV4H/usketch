---
"@edv4h/usketch-plugin-character": patch
---

An airborne character no longer leans with the terrain below it. In the air (jumping, falling, hovering) the body's slope lean fades out over the first `AIR_LEAN_FADE` (8) world units above the ground, so the ground it flies over doesn't tip it. Its shadow still lies along the ground.
