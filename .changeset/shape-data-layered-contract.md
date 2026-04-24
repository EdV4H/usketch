---
"@edv4h/usketch-shared": major
"@edv4h/usketch-store": major
"@edv4h/usketch-plugin-canvas-filter": major
"@edv4h/usketch-plugin-shape-text": major
"@edv4h/usketch-plugin-shape-sticky": major
"@edv4h/usketch-plugin-shape-freedraw": major
"@edv4h/usketch-plugin-shape-connector": major
"@edv4h/usketch-plugin-shape-wireframe": major
"@edv4h/usketch-plugin-shape-counter": major
"@edv4h/usketch-plugin-shape-frame": major
"@edv4h/usketch-plugin-shape-island": major
"@edv4h/usketch-plugin-shape-image": major
"@edv4h/usketch-plugin-shape-community-region": major
"@edv4h/usketch-plugin-shape-board-portal": major
"@edv4h/usketch-plugin-board-info-panel": major
"@edv4h/usketch-plugin-community-chat": major
"@edv4h/usketch-plugin-ai-agent": major
"@edv4h/usketch-plugin-ai-copilot": major
"@edv4h/usketch-plugin-ai-recognize": major
"@edv4h/usketch-plugin-tool-select": major
"@edv4h/usketch-plugin-debug-hud": major
"@edv4h/usketch-shape-utils": major
---

`ShapeData` contract redesign — layered 3-tier extension model. Closes #575.

## Breaking changes

**1. `ShapeData` is now generic and strictly typed.**

```ts
// Before
interface ShapeData {
  /* core fields */
  [key: string]: unknown;  // any field accepted
}

// After
interface ShapeData<TMeta = Record<string, unknown>> {
  id: string; type: string; x: number; y: number;
  width: number; height: number; style: ShapeStyle;
  rotation?: number; zIndex?: string;
  createdAt?: number; updatedAt?: number;
  parentId?: string;          // NEW — was implicit in plugins
  meta?: TMeta;               // NEW — typed domain data
  [key: `x-${string}`]: unknown;  // NEW — only `x-*` prefixed keys accepted
}
```

**2. `_createdAt` / `_updatedAt` renamed** to `createdAt` / `updatedAt` (no leading underscore). The fields are now explicit core fields instead of magic strings stamped by the store.

**3. `canvas-filter`**: `TimeRangeFilter.field` type is now `"createdAt" | "updatedAt"` (was `"_createdAt" | "_updatedAt"`).

## Migration guide

Shape data can live in three places, in this priority:

1. **Core fields** — listed explicitly in `ShapeData`. Do not redefine.
2. **Plugin-intrinsic fields** — declare an extension interface and use it inside your plugin:
   ```ts
   interface TextShapeData extends ShapeData {
     text: string;
     fontSize: number;
   }
   function render(shape: ShapeData) {
     const data = shape as TextShapeData;
     // ...
   }
   ```
3. **Application/domain data — use `meta` (preferred)**:
   ```ts
   interface WeboardMeta { employeeId?: string }
   const shape: ShapeData<WeboardMeta> = { ..., meta: { employeeId: "emp_1" } };
   ```
4. **Escape hatch — `x-*` prefix** for top-level fields `meta` cannot cover:
   ```ts
   const shape: ShapeData = { ..., "x-legacyFlag": true };
   ```

Previously any field name was allowed via `[key: string]: unknown`. That is no longer the case: fields outside the `x-*` namespace must be defined by a plugin extension interface or core.

If you persisted shapes with top-level domain fields like `{ employeeId: "emp_1" }`, either move them to `meta.employeeId`, or rename to `x-employeeId`. If you stamped shapes with `_createdAt` / `_updatedAt`, rename to `createdAt` / `updatedAt` in stored data.

See the [shape-system](https://usketch.dev/docs/concepts/shape-system/) and [shape-plugin guide](https://usketch.dev/docs/guides/shape-plugin/) for the full contract.
