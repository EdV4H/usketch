---
"@edv4h/usketch-store": major
---

Remove unused `getConnectorsForShape` export.

This helper was added speculatively but never called anywhere in the monorepo (the actual delete-cascade logic in `commands.ts:createDeleteWithChildrenCommand` inlines its own connector lookup). Since the function leaks `connector`-specific knowledge (`sourceId` / `targetId` field names, `type === "connector"` check) into the generic store package, removing it both deletes dead code and reduces the store's coupling to a particular shape plugin.

If you were importing this function externally, replace with an inline implementation or wait for the upcoming `ShapeDefinition.getReferencedShapeIds` registry-based replacement (#584-related).
