---
"@edv4h/usketch-plugin-shape-3d": patch
---

The 3D layer checks a shape's size and position before sampling the terrain height for `groundFlat`, so shapes off screen or too small to draw no longer call `heightAt` on every frame of a 3D view. On a wide board over an infinite elevation terrain this stops the terrain's generated-chunk cache from being refilled every frame. What is drawn is unchanged.
