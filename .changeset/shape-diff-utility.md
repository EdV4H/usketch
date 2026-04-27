---
"@edv4h/usketch-shared": minor
"@edv4h/usketch-plugin-tool-select": patch
---

Add `diffShape` / `bidiffShape` utilities to `@edv4h/usketch-shared` and migrate `tool-select` to use them.

These helpers compute the field-level diff between two shapes of the same type without knowing the concrete shape type at compile time — the dynamic field iteration that `tool-select` needs for resize undo/redo. The `Record<string, unknown>` cast required to iterate `ShapeData` fields is now encapsulated in the utility, so the type escape is confined to one place instead of being repeated at every call site.

Follow-up to #582 / #575 — eliminates the three local `as unknown as Record<string, unknown>` casts that the `[key: \`x-${string}\`]: unknown` index signature change introduced in `tool-select`.
