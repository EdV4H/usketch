---
"@edv4h/usketch-plugin-domain-design": minor
"@edv4h/usketch-web": patch
---

Add `@edv4h/usketch-plugin-domain-design` — the official plugin for drawing **DDD** diagrams (both strategic and tactical) on a uSketch board.

Provides 5 shape types under a single `domain-draw` tool (shortcut `d`):

- **Strategic**: `domain-bounded-context` (with team / Core/Supporting/Generic classification), `domain-context-map-connector` (Customer/Supplier, Conformist, ACL, Shared Kernel, OHS, Partnership, Published Language, Separate Ways).
- **Tactical**: `domain-aggregate`, `domain-class-box` (Entity / ValueObject / Service / Repository / DomainEvent / Factory with stereotype dropdown, class name, attributes, methods), `domain-tactical-connector` (inheritance / realization / composition / aggregation / association / dependency).

Inline editing is supported: double-click a `domain-bounded-context` / `domain-aggregate` / `domain-class-box` to edit its name (plus attributes / methods / stereotype for ClassBox). Edits go through the command system and are undoable.

This is the **first official plugin to fully use `ShapeData<TMeta>`'s `meta` field** for domain-specific data — the pattern recommended in `shape-system.mdx`. Existing plugins (`connector`, `frame`, `text`, ...) currently put intrinsic fields directly on `ShapeData`; migrating them to `meta` is tracked as a follow-up.

`apps/web` registers the plugin in its default `basePlugins` array, so it's available out of the box.
