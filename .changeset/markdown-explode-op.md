---
"@edv4h/usketch-plugin-markdown-to-shape": minor
---

Export the "Markdown を図形に分解" operation as plain functions: `explodeMarkdownShape({ store, registry, shapes, commands? }, id)` replaces a markdown shape with its decomposition as one undoable step (returns the new shapes), and `selectedMarkdownShapeId(store)` finds the single selected markdown shape. The Control HUD action now just calls them, so a host can run the same conversion without the HUD. The action's behaviour is unchanged.
